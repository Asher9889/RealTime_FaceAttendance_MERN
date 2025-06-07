import mongoose, { Connection } from "mongoose";
import  config from "../config"
import { ApiErrorResponse } from "../utils";
import { StatusCodes } from "http-status-codes";


async function connectMongoDB():Promise<Connection | undefined>{
    try {
        await mongoose.connect(config.mongoDBURL + "/" + config.dbName);
        const connection = mongoose.connection;
        console.log(`MongoDB connected to ${connection.name} database`)
        return connection;
    } catch (error) {
        throw new ApiErrorResponse(StatusCodes.INTERNAL_SERVER_ERROR, "Failed to connect to MongoDb")
    }
}

mongoose.connection.on("connecting", ()=>{
    console.log("trying to connect");
});

mongoose.connection.on("connected", ()=>{
    console.log("Successfully connected");
});

mongoose.connection.on("disconnected", ()=>{
    console.log("MongoDB disconnected");
})

process.on("SIGINT", async ()=>{
    await mongoose.connection.close();
    process.exit(0);
})

export default connectMongoDB;