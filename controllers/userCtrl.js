const Users = require('../models/userModel')
// const Payments = require('../models/paymentModel')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const client = require("twilio")(process.env.acountSID, process.env.authToken)
const axios = require('axios');
const { findOneAndUpdate } = require('../models/userModel');
const ProUser = require('../models/productModel')
const { ObjectId } = require('mongodb');
const userCtrl = {

    register: async (req, res) => {

        let newUser;

        try {

            const { name, email, role, password, google } = req.body;

            // verify user for only google authentication 
            if (google) {
                console
                if (email) {
                    const user = await Users.findOne({ email })

                    if (user) return res.status(400).json({ msg: "The email already exists." })
                    let newAccount = await Users.create({
                        email,
                        name,
                        role,
                        loginBy: google
                    })
                    newAccount.save()
                    newUser = newAccount

                }
            } else {

                const user = await Users.findOne({ email })
                if (user) return res.status(400).json({ msg: "The email already exists." })
                if (password.length < 6)
                    return res.status(400).json({ msg: "Password is at least 6 characters long." })

                // Password Encryption
                const passwordHash = await bcrypt.hash(password, 10)

                newUser = new Users({
                    name, email, role, password: passwordHash
                })

                // Save mongodb
                await newUser.save()
                // res.json({msg:"Register Success!"})

            }

            // Then create jsonwebtoken to authentication
            const accesstoken = createAccessToken({ id: newUser._id })
            const refreshtoken = createRefreshToken({ id: newUser._id })
           
            res.cookie('token', accesstoken, {
                maxAge: 7 * 24 * 60 * 60 * 1000,// 7d
                httpOnly: true,
                /* signed: true,
                secure: true,
                sameSite:'none', */

            })

            res.json({ accesstoken })

        } catch (err) {
            const news = 'fro'
            console.log(err)
            return res.status(500).json({ news, msg: err.message })
        }
    },


    validation: async (req, res) => {
        try {
            
            const result = await Users.findById(req?.user?.id)
            if (req?.user?.id) {
                res.status(200).json({
                    message: 'Success',
                    data: result
                })
            }
        } catch (error) {

            console.log(error)
        }
    },
    deleteUser: async (req, res) => {
        const result = await Users.deleteOne({ email: req.body.email })
        res.send(result)
    },
    findUser: async (req, res) => {
        const result = await Users.find({ email: req.body.email })
        res.send(result)
    },


    login: async (req, res, next) => {
     
        try {
            let userrole;
            let user;
            let accesstoken;
            let refreshtoken


            const { email, password, google } = req.body;

            if (google) {
                if (email) {

                    const user = await Users.findOne({ email })

                    if (!user) return res.status(400).json({ msg: "User does not exist." })
                    accesstoken = createAccessToken({ id: user._id })
                    refreshtoken = createRefreshToken({ id: user._id })
                    userrole = await Users.findById(user._id).select('role')
                   
                }
            } else {

                user = await Users.findOne({ email })
                if (!user) return res.status(400).json({ msg: "User does not exist." })

                const isMatch = await bcrypt.compare(password, user.password)

                if (!isMatch) return res.status(400).json({ msg: "Incorrect password." })
                // If login success , create access token and refresh token
                accesstoken = createAccessToken({ id: user._id })
                refreshtoken = createRefreshToken({ id: user._id })
                userrole = await Users.findById(user._id).select('role')
               
            }



            const val = userrole.role;

            res.cookie('token', accesstoken, {
                maxAge: 7 * 24 * 60 * 60 * 1000,// 7d
                httpOnly: false,
                // signed: true,
                // secure: true,
                // sameSite:'none',
            })
            // next()
            res.json({ accesstoken, val })
        } catch (err) {
            console.log(err)
            return res.status(500).json({ msg: err.message })
        }
    },
    logout: async (req, res) => {
        try {
            res.clearCookie('token')
            return res.json({ msg: "Logged out" })
        } catch (err) {
            return res.status(500).json({ msg: err.message })
        }
    },

    updatePass: async (req, res) => {
        try {
            const { oldPassword, newPassword, google } = req.body || {}
            const user = await Users.findById({ _id: req.user.id })

            if (!google) {

                const isMatch = await bcrypt.compare(oldPassword, user.password)
                if (isMatch) {
                    // Password Encryption
                    const passwordHash = await bcrypt.hash(newPassword, 10)
                    const result = await Users.findOneAndUpdate({ email: user.email }, { password: passwordHash })
                   
                    if (result) {
                        res.status(200).send({
                            message: 'Success',
                            status: true
                        })
                    }
                } else {
                    res.status(401).json({
                        message: 'Password is incorrect'
                    })
                }

            } else {
                res.status(401).json({
                    msg: "You can't change the password"
                })
            }

        } catch (error) {
            console.log(error)
        }
    },

    refreshToken: (req, res) => {
        try {
            const rf_token = req.cookies.refreshtoken;
            if (!rf_token) return res.status(400).json({ msg: "Please Login or Register" })

            jwt.verify(rf_token, process.env.REFRESH_TOKEN_SECRET, (err, user) => {
                if (err) return res.status(400).json({ msg: "Please Login or Register" })

                const accesstoken = createAccessToken({ id: user.id })

                res.json({ accesstoken })
            })

        } catch (err) {
            return res.status(500).json({ msg: err.message })
        }

    },

    getUser: async (req, res) => {

        try {

            let user = await Users.findById(req.user.id).select('-password').populate('saveVideo')
            if (!user) return res.status(400).json({ msg: "User does not exist." })

            
            res.json(user)
        } catch (err) {
            console.log(err)
            return res.status(500).json({ msg: 'Invalid' })
        }
    },
    getImage: async (req, res) => {
        try {
            const user = await Users.findById(req.user.id).select('profile name about whats phone')
          
            if (!user) return res.status(400).json({ msg: "User does not exist." })
            res.json(user)
           
        } catch (err) {
            return res.status(500).json({ msg: 'Invalid' })
        }
    },

    getOTP: async (req, res) => {
        try {
        
            const user = await Users.findById(req.user.id).select('phone')
            if (!user) return res.status(400).json({ msg: "User does not exist." })
          
            if (user.phone) {
                client
                    .verify
                    .services(process.env.serviceID)
                    .verificationChecks
                    .create({
                        to: `+${user.phone}`,
                        channel: 'sms'
                    })
                    .then(data => {
                        res.status(200).send({
                            message: "Verification is sent!!",
                            phonenumber: user.phone,
                            data
                        })
                    })
            } else {
                res.status(400).send({
                    message: "Wrong phone number :(",
                    phonenumber: user.phone,
                    data
                })
            }
        } catch (err) {
            return res.status(500).json({ msg: err.message })
        }
    },






    About: async (req, res) => {
        try {
          
            const user = await Users.findById(req.user.id)
            if (!user) return res.status(400).json({ msg: "User does not exist." })

            await Users.findOneAndUpdate({ _id: req.user.id }, {
                about: req.body.about,
                profile: req.body.profile,
                name: req.body.name
            })
            
            return res.json({ msg: "Done Bro" })

        } catch (err) {
            return res.status(500).json({ msg: err.message })
        }
    },

    Locations: async (req, res) => {
        try {
            const user = await Users.findById(req.user.id).select('latitude longitude')
            if (!user) return res.status(400).json({ msg: "User does not exist." })
            res.json(user)
        } catch (err) {
            return res.status(500).json({ msg: err.message })
        }
    },


    complete: async (req, res) => {
        try {
            const user = await Users.findById(req.user.id)
          
            if (!user) return res.status(400).json({ msg: "User does not exist." })

            const params = {
                access_key: '4c91de2d5e397a5c46236ac630adc668',
                query: req.body.address
            }


            const resp = await axios.get('http://api.positionstack.com/v1/forward', { params })
          
            if (!resp.data.data[0]) {
                return res.status(400).send({
                    message: 'Please add a valid address'
                })
            }
            const lat = resp.data.data[0].latitude;
            const lang = resp.data.data[0].longitude;

            await Users.findOneAndUpdate({ _id: req.user.id }, {
                phone: req.body.phone,
                address: req.body.address,
                country: req.body.country,
                latitude: lat,
                longitude: lang,
            })

            return res.json({ msg: "Completed" })


        } catch (err) {
            console.log(err.message);
            return res.status(500).json({ msg: err.message })
        }
    },



    AddressUpdate: async (req, res) => {
        try {
            const user = await Users.findById(req.user.id)
           
            if (!user) return res.status(400).json({ msg: "User does not exist." })

            const params = {
                access_key: '4c91de2d5e397a5c46236ac630adc668',
                query: req.body.address
            }


            const resp = await axios.get('http://api.positionstack.com/v1/forward', { params })

            if (!resp.data.data[0]) {
                return res.status(400).send({
                    message: 'Please add a valid address'
                })
            }


            const lat = resp.data.data[0].latitude;
            const lang = resp.data.data[0].longitude;



            const result = await Users.findOneAndUpdate({ _id: req.user.id }, {
                address: req.body.address,
                latitude: lat,
                longitude: lang,
            })

            return res.status(200).json({
                msg: "Address Completed",
                data: result
            })


        } catch (err) {
            console.log(err.message);
            return res.status(500).json({ msg: err.message })
        }
    },

    editprofile: async (req, res) => {
        try {
            const user = await Users.findById(req.user.id)
            if (!user) return res.status(400).json({ msg: "User does not exist." })

            const result = await Users.findOneAndUpdate({ _id: req.user.id }, {
                name: req.body.name,
                phone: req.body.phone,
                about: req.body.about,
                whats: req.body.whats,
                profile: req.body.profile

            })
           
          
            return res.json({ msg: "Completed" })


        } catch (err) {
            return res.status(500).json({ msg: err.message })
        }
    },
    deleteUser: async (req, res) => {
        try {
            const result = await Users.findByIdAndDelete(req.user.id)

            if (result?._id) {
                res.status(200).send({
                    data: result,
                    status: true
                })
            }
        } catch (error) {
            console.log(error)
        }
    },

    addSaved: async (req, res) => {
        try {
            const user = await Users.findById(req.user.id)
            if (!user) return res.status(400).json({ msg: "User does not exist." })

            await Users.findOneAndUpdate({ _id: req.user.id }, {
                cart: req.body.cart
            })

            return res.json({ msg: "Added to cart" })
        } catch (err) {
            return res.status(500).json({ msg: err.message })
        }
    },
    //     history: async(req, res) =>{
    //         try {
    //             const history = await Payments.find({user_id: req.user.id})

    //             res.json(history)
    //         } catch (err) {
    //             return res.status(500).json({msg: err.message})
    //         }
    //     }
    //  }

}
const createAccessToken = (user) => {
  
    return jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1d' })
}
const createRefreshToken = (user) => {
    return jwt.sign(user, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' })
}

module.exports = userCtrl