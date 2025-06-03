import { Socket } from "socket.io";
import { faceService } from "../services";

export async function onFrame(socket: Socket,
    data: { image: string }):Promise<void> {
        try {
            
         const result = await faceService.processImageFrame(socket, data.image)
        } catch (error) {
            
        }
}