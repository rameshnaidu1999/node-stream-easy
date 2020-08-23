const express = require('express');
const app = express();
const http = require('http').createServer(app);
const path = require('path')

const mongodb = require('mongodb');
const mongoClient = mongodb.MongoClient;
const ObjectId = mongodb.ObjectId;

const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');

const formidable = require("formidable");
const fileSystem = require("fs");
const { getVideoDuration, default: getVideoDurationInSeconds } = require("get-video-duration");

const expressSession = require("express-session");
app.use(expressSession({
    "key": "user_id",
    "secret": "User secreat Object Id",
    "resave": true,
    "saveUninitialized": true
}));

app.use(bodyParser.json({
    limit: "10000mb"
}));
app.use(bodyParser.urlencoded({
    extended: true,
    limit: "10000mb",
    parameterLimit: 1000000
}));

app.use('/public', express.static(__dirname + "/public"));
app.set('view engine', "ejs")

http.listen(5000,function(err){
    if(err) throw err;
    console.log("Server Started on Port 5000!");
    
    mongoClient.connect("mongodb+srv://Ramesh:ramesh123@cluster0-n5l8y.mongodb.net/test?retryWrites=true&w=majority",{useUnifiedTopology: true, useNewUrlParser: true}, function(err, client){
        var database = client.db("my_video_db");
        if(err) throw err;
        console.log("Databse connected to DB.");

        // Function to get User Document
        function getUser (id, callback){
            database.collection("users").findOne({
                "_id": ObjectId(id)
            }, function(error, user){
                callback(user)
            })
        }

        app.get('/', (req, res) => {
            res.render('index',{
                "isLogin": req.session.user_id ? true : false 
            });
        });
    
        app.get('/signup', (req, res) => {
            res.render("signup");
        });
    
        app.post('/signup', (req, res) => {
            database.collection("users").findOne({
                "email": req.body.email
            }, function(err, user){
                if(user == null){
                    //not exists
    
                    //hash password
                    bcrypt.hash(req.body.password, 10, function(err, hash){
                        database.collection("users").insertOne({
                            "name": req.body.name,
                            "email": req.body.email,
                            "password": hash,
                            "coverPhoto": "",
                            "image": "",
                            "subscribers": 0,
                            "subscriptions": [], // Channels I Subscribed
                            "videos": [],
                            "history": [],
                            "notifications": []
                        }, function(err,data){
                            res.redirect("login");
                        })
                    })
                } else {
                    res.send("Email Laready Exists")
                }
            })
            
        });

        app.get('/login', (req, res) => {
            res.render("login",{
                "error":"",
                "message": ""
            });
        });

        app.post('/login', (req, res) => {
            //email check
            database.collection("users").findOne({
                "email":req.body.email
            }, function(err,user){
                if(user == null){
                    res.send("Email Not exists")
                } else {
                    bcrypt.compare(req.body.password, user.password, function(err, isVerify){
                        if(isVerify){
                            //save user ID in Session
                            req.session.user_id = user._id;
                            res.redirect("/")
                        } else {
                            res.send("Password is Not Correct")
                        }
                    })
                }
            })
        });

        app.get('/logout', (req, res) => {
            req.session.destroy();
            res.redirect("/");
        });

        app.get('/upload', (req, res) => {
            // create upload page
            if(req.session.user_id){
                res.render("upload", {
                    "isLogin": true
                })
            } else {
                res.redirect("/login")
            }
        });

        app.post('/upload-video', (req, res) => {
            if(req.session.user_id){
                var formData = new formidable.IncomingForm();
                formData.maxFileSize = 1000 * 1024 *1024;
                formData.parse(req, function(error, fields, files){
                    var title = fields.title;
                    var description = fields.description;
                    var tags = fields.tags;
                    var category = fields.category;

                    var oldPathThumbnail = files.thumbnail.path;
                    var thumbnail = "public/thumbnails/" + new Date().getTime() + "_" +files.thumbnail.name;

                    fileSystem.rename(oldPathThumbnail, thumbnail, function(error){

                    })

                    var oldPathVideo = files.video.path;
                    var newPath = "public/videos/" + new Date().getTime() + "_" +files.video.name;

                    fileSystem.rename(oldPathVideo, newPath, function(error){
                        // get user data to save in videos document
                        
                        getUser(req.session.user_id, function(user){
                            var currentTime = new Date().getTime();

                            //get fideo duration
                            getVideoDurationInSeconds(newPath).then(function(duration){
                                var hours = Math.floor(duration / 60 / 60);
                                var minutes = Math.floor(duration/60) - (hours * 60);
                                var seconds = Math.floor(duration % 60 );
                            });

                            //insert in databse
                            database.collection("videos").insertOne({
                                "user": {
                                    "_id": user._id,
                                    "name": user.name,
                                    "image": user.image,
                                    "subscribers": user.subscribers
                                },
                                "filePath": newPath,
                                "thumbnail": thumbnail,
                                "title": title,
                                "description": description,
                                "tags": tags,
                                "category": category,
                                "createdAt": currentTime,
                                "minutes": minutes,
                                "seconds": seconds,
                                "watch": currentTime,
                                "views": 0,
                                "playlist": "",
                                "likers": [],
                                "dislikers": [],
                                "comments": []
                            }, function(error, data){
                                // insert in user collection too

                                database.collection("users").updateOne({
                                    "_id": ObjectId(req.session.user_id)
                                },{
                                    $push: {
                                        "videos":{
                                            "_id": data.insertedId,
                                            "title": title,
                                            "views": 0,
                                            "thumbnail": thumbnail,
                                            "watch": currentTime,
                                        }
                                    }
                                })
                                res.redirect("/");
                            })
                        
                        })
                    })
                })
            } else {
                res.redirect("/login")
            }
        });
    })
})