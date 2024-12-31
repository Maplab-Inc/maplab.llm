
export interface IResponseError {
    error: {
        code: number;
        message: string
    },
    info: {
        engine: {
            build_date: Date,
            version: string
        },
        timestamp: number
    }
}