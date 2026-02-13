import 'dotenv/config';
import express from 'express';
import { agentRouter } from './api/agent';
import { snapshotRouter } from './api/snapshot';

const app = express();
const port = Number(process.env.PORT || 8787);

app.use(express.json({ limit: '1mb' }));

app.use('/api', snapshotRouter);
app.use('/api', agentRouter);

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`API server listening on http://localhost:${port}`);
});
