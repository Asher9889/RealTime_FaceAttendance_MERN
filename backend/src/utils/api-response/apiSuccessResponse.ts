interface IApiSuccessRes{
    status: boolean;
    statusCode: number;
    message: string;
    data?:any
}

class ApiSuccessResponse implements IApiSuccessRes {
    status: boolean;
    statusCode:number;
    message:string;
    data: any
    constructor(statusCode:number, message:string, data:any = null){
        this.status = true;
        this.statusCode = statusCode;
        this.message = message;
        this.data = data || null;
    }
}

export default ApiSuccessResponse;