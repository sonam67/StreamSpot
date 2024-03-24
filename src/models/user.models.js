import mongoose,{Schema} from "mongoose"
import bcrypt from "bcrypt"
import  jwt from "jsonwebtoken"

const userSchema=new Schema({
    username:{
        type: String,
        required:true,
        unique:true,
        trim:true,
        lowercase:true,
        index:true
    },
    fullname:{
        type: String,
        required:true,
        trim:true,
    },
    email:{
        type: String,
        required:true,
        unique:true,
        trim:true,
        lowercase:true
    },
    avatar:{
        type:String,
        required:true
    },
    coverImage:{
        type: String
    },
    watchHistory:[
        {
            type:Schema.Types.ObjectId,
            ref:"Video"
        }
    ],
    password:{
        type:String,
        required:[true,'Password is required']
    },
    refreshToken:{
        type:String
    }
    
},{timestamps:true})

userSchema.pre("save",async function(next){
    if(!this.isModified("password")) return next();

    this.password=await bcrypt.hash(this.password,10)
    next()
})

userSchema.methods.isPasswordCorrect=async function(password){
    return bcrypt.compare(password,this.password)
}

//token generation

userSchema.methods.generateAccessToken= function(){
    return jwt.sign(
        {
            _id:this._id,
            email:this.email,
            username:this.username,
            fullname:this.fullname
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn:3600
        }
    )
}
userSchema.methods.generateRefreshToken=function(){
    return jwt.sign(
        {
            _id:this._id,
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn:3600
        }
    )
}

export const User= mongoose.model("User",userSchema)