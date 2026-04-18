// Re-export from postcss.config.js - do not modify this file
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const config = require('./postcss.config.js');
export default config;
