
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

const app=express();
const PORT=Number(process.env.PORT)||4000;

app.use(helmet());
app.use(cors({origin:'http://localhost:5173'}));
app.use(express.json());

app.get('/api/health',(_req,res)=>{
  res.status(200).json({
    status:'ok',
    service:'sharktankdbms-api',
    timestamp:new Date().toISOString()
  });
});

app.listen(PORT,()=>{
  console.log(`Shark Tank DBMS API running at http://localhost:${PORT}`);
});
