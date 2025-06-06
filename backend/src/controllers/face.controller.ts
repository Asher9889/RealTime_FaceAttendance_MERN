import { Socket } from "socket.io";
import { faceService } from "../services";

export async function onFrame(socket: Socket,
    data: { image: string }):Promise<void> {
        try {
            // console.log(" i am executed")
         const result = await faceService.run(socket, data.image)
         
        } catch (error) {
            
        }
}