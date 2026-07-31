import { assertProductionEnvironment } from "./deploy-config";

assertProductionEnvironment(process.env);
console.log("Production deployment configuration is valid.");
