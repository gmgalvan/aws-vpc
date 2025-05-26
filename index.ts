import * as pulumi from "@pulumi/pulumi";
import { createVpcFromConfig } from "./vpc";

// Create the VPC from config settings
const vpc = createVpcFromConfig();

// Export outputs
export const vpcId = vpc.vpc.id;
export const publicSubnetIds = vpc.publicSubnetIds;
export const privateSubnetIds = vpc.privateSubnetIds;
export const natGatewayIds = vpc.natGateways.map(ng => ng.id);