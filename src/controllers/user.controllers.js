import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.models.js";
import { deleteFromCloudinary, uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import CircularJSON from "circular-json";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshToken = async (userId) => {
  try {
    // Verify userId
    if (!userId) {
      throw new ApiError(400, "Invalid userId");
    }

    // Find user
    const user = await User.findById(userId);

    // Verify user
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    // Generate tokens
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    // Update refreshToken in the user document
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    console.error("Error generating access and refresh tokens:", error);
    throw new ApiError(500, "Something went wrong while generating tokens");
  }
};

const registerUser = asyncHandler(async (req, res) => {
  //get data from frontend with the help of res.body or res. something
  //validate this data with the help of multer middleware-data should not be empty
  //check if user is already exist or  not through username or email
  //if user is new then check coverimage and avatr is stored in multer storage
  //upload avatar on cloudinary and check uploaded on cloudinary or not
  //create user object bcz data stored in mobgodb as objects
  //remove pass and token from db for security purpose
  //check for user creation , user is created or not
  //return the response

  const { fullname, email, password, username } = req.body; //step 1
  console.log("email: ", email);

  //step 2
  if (
    [fullname, email, password, username].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  //step 3
  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });
  if (existedUser) {
    throw new ApiError(409, "User with username or email already exists");
  }

  //step 4
  const avatarLocalPath = req.files?.avatar[0].path;
  let coverImageLocalPath;

  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is Required");
  }

  //step 5
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(400, "Avatar file is Required");
  }

  //step 6
  const user = await User.create({
    username: username.toLowerCase(),
    fullname,
    email,
    password,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
  });

  //step 7
  const createdUser = User.findById(user._id).select("-password -refreshToken");
  //step 8
  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  //step 9
  // Serialize the object before sending it in the response
  const serializedUser = CircularJSON.stringify(createdUser);
  return res
    .status(201)
    .json(new ApiResponse(200, serializedUser, "User registered successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  //algorithm for login code

  //get data from frontend using req.body
  //check by email or username
  //find the user in database
  //chekc the password find finding
  //refresh and access token send
  //send cookies
  //return res

  //step 1
  const { username, password, email } = req.body;

  //step 2
  if (!username && !email) {
    throw new ApiError(400, "username or email required");
  }

  //step 3
  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  //step 4
  const isPasswordValid = user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalide user credentials");
  }

  //stpe 5
  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  //step 6
  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged in successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookie.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "unauthrized refresh token");
  }
  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh token is expired of used");
    }

    const { accessToken, newrefreshToken } = generateAccessAndRefreshToken(
      user._id
    );

    const options = {
      httpOnly: true,
      secure: true,
    };

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newrefreshToken, options)
      .json(
        200,
        { accessToken, refreshToken: newrefreshToken },
        "access token refreshed"
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const user = await user.findById(req.user?._id);
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordCorrect) {
    throw new ApiError(400, "Invalid old password");
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullname, email } = req.body;

  if (!fullname || !email) {
    throw new ApiError(400, "All fields are required");
  }

  const user = User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullname: fullname,
        email: email,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfuly"));
});

const updateUserAvatar=asyncHandler(async(req,res)=>{
  const avatarLocalPath=req.file?.path

  if(!avatarLocalPath){
    throw new ApiError(400,"Avatar is missing")
  }

  const currentUser= await User.findById(req.user?._id)
  const currentAvatar=currentUser.avatar.url

  const avatar= await uploadOnCloudinary(avatarLocalPath)

  if(!avatar.url){
    throw new ApiError(400,"error while uploading avatar");
  }
  const user=await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set:{
        avatar:avatar.url
      }
    },
    {new:true}
  ).select("-password")

  if(currentAvatar){
    await deleteFromCloudinary(currentAvatar);
  }

  return res
  .status(200)
  .json(
    new ApiResponse(200,user,"Avatar updated successfully")
  )

})

const updateUserCoverImage=asyncHandler(async(req,res)=>{
  const coverImageLocalPath=req.file?.path;

  if(!coverImageLocalPath){
    throw new ApiError(400,"cover image is missing")
  }

  const coverImage=await uploadOnCloudinary(coverImageLocalPath)

  if(!coverImage){
    throw new ApiError(400,"error while uploading cover image")
  }

  const user =await User.findByIdAndUpdate(
    req.user?._id,{
      $set:{
        coverImage:coverImage.url
      }
    },
    {new:true}
  ).select("-password")

  return res
  .status(200)
  .json(
    new ApiResponse(200,user,"cover image updated successfully")
  )
})

const getUserChannelprofile=asyncHandler(async(req,res)=>{
  const {username}= req.params;

  if(!username?.trim()){
    throw new ApiError(400,"username is missing")
  }

  const channel=await User.aggregate([
    {
        $match:{
          username:username.toLowerCase()
        }
    },
    {
      $lookup:{
        from:"subscribers",
        localField:"_id",
        foreignField:"channel",
        as:"subscribers"
      }
    },
    {
      $lookup:{
        from:"subscribers",
        localField:"_id",
        foreignField:"subcribers",
        as:"subscribedTo"
      }

    },
    {
      $addFields:{
        $subscribersCount:{
          $size:"subscribers"
        },
        $channelsSubscribedToCount:{
          $size:"subscribedTo"
        },
        isSubscribed:{
          $cond:{
            if: {$in:[req.user?._id,"$subscribers.subscriber"]},
            then:true,
            else:false
          }
        }
      }
    },
    {
      $project:{
        fullname:1,
        username:1,
        subscribersCount:1,
        channelsSubscribedToCount:1,
        isSubscribed:1,
        avatar:1,
        coverImage:1,
        email:1
      }
    }
  ])
  console.log(channel)
  if(!channel?.length){
    throw new ApiError(404,"channel does not exists")
  }

  return res
  .status(200)
  .json(
    new ApiResponse(200,channel[0],"User channel fetched successfully")
  )
})

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelprofile
};
