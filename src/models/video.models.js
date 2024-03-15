import mongoose from "mongoose";


const videoSchema = new Schema({
    videoFile:{
        type:String,//cloudianry url
        required:true
    },
    thumbnail:{
        type:String,
        required:true
    },
    thumbnail:{
        type:String,
        required:true
    },
    description:{
        type:String,
        required:true
    },
    duration:{
        type:Number,//cloudinary url
        required:true
    },
    views:{
        type:Number,
        default:0
    },
    isPublished:{
        type:Boolean,
        default:true
    },
    owner:{
        type:Schema.Types,ObjecId,
        ref:"User"
    }

},{timestamps:true})

export const Video = mongoose.model("Video",videoSchema)