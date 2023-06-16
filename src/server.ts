import { config } from 'dotenv';
config();
import express from 'express';
import { getResponse, initIndex } from './controllers/chat.controller';

// import { ValidateEnv } from '@utils/validateEnv';
// ValidateEnv();

const app = express();

const PORT = 1001

app.use(express.json());

// body-parser to parse the incoming request body
app.use(express.urlencoded({ extended: true }));


// app.listen(PORT, () => {
//     console.log(`=================================`);
//     console.log(`======= ENV: ${"local"} =======`);
//     console.log(`🚀 App listening on the port ${PORT}`);
//     console.log(`=================================`);
// });

app.post("/chat/ustaad", getResponse)


initIndex().then(() => {
    app.listen(PORT, () => {
        console.log(`=================================`);
        console.log(`======= ENV: ${"local"} =======`);
        console.log(`🚀 App listening on the port ${PORT}`);
        console.log(`=================================`);
    });
})

