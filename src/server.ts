import { config } from 'dotenv';
config();
import express from 'express';
import { getResponse, initIndex } from './controllers/chat.controller';

const app = express();

const PORT = 3000

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

app.get('/', function (req, res) {
    res.send('Hello World!')
})

app.post("/chat/ustaad", getResponse)

initIndex().then(() => {
    app.listen(PORT, () => {
        console.log(`=================================`);
        console.log(`🚀 App listening on the port ${PORT}`);
        console.log(`=================================`);
    });
})

