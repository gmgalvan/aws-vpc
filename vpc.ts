import * as pulumi from "@pulumi/pulumi";
import * as aws    from "@pulumi/aws";

// 1) Read AWS region from the "aws" namespace, and cast to aws.Region
const awsConfig = new pulumi.Config("aws");
const region     = (awsConfig.get("region") ?? "us-east-1") as aws.Region;

// 2) Create an explicit AWS provider using that region
const awsProvider = new aws.Provider("aws-provider", {
    region: region,
});

export interface VpcConfig {
    name: string;
    cidrBlock: string;
    azCount: number;
    publicSubnets: number;
    privateSubnets: number;
    natPerPrivateSubnet: boolean;
    tags?: { [key: string]: string };
}

export class Vpc extends pulumi.ComponentResource {
    public readonly vpc: aws.ec2.Vpc;
    public readonly publicSubnetIds: pulumi.Output<string>[];
    public readonly privateSubnetIds: pulumi.Output<string>[];
    public readonly natGateways: aws.ec2.NatGateway[];
    public readonly internetGateway: aws.ec2.InternetGateway;
    public readonly publicRouteTable: aws.ec2.RouteTable;
    public readonly privateRouteTables: aws.ec2.RouteTable[];

    constructor(name: string, config: VpcConfig, opts?: pulumi.ComponentResourceOptions) {
        super("custom:resource:Vpc", name, {}, opts);

        // VPC itself
        this.vpc = new aws.ec2.Vpc(name, {
            cidrBlock:          config.cidrBlock,
            enableDnsHostnames: true,
            enableDnsSupport:   true,
            tags: {
                Name: config.name,
                ...config.tags,
            },
        }, { parent: this, provider: awsProvider });

        // Internet Gateway
        this.internetGateway = new aws.ec2.InternetGateway(`${name}-igw`, {
            vpcId: this.vpc.id,
            tags: {
                Name: `${config.name}-igw`,
                ...config.tags,
            },
        }, { parent: this, provider: awsProvider });

        // Shared public route table
        this.publicRouteTable = new aws.ec2.RouteTable(`${name}-public-rt`, {
            vpcId: this.vpc.id,
            tags: {
                Name: `${config.name}-public-rt`,
                ...config.tags,
            },
        }, { parent: this, provider: awsProvider });

        // Route to IGW
        new aws.ec2.Route(`${name}-public-route`, {
            routeTableId:         this.publicRouteTable.id,
            destinationCidrBlock: "0.0.0.0/0",
            gatewayId:            this.internetGateway.id,
        }, { parent: this, provider: awsProvider });

        // Prepare arrays
        this.publicSubnetIds    = [];
        this.privateSubnetIds   = [];
        this.natGateways        = [];
        this.privateRouteTables = [];

        // Fetch AZs
        const availabilityZones = aws.getAvailabilityZones({ state: "available" }, { provider: awsProvider });

        // Build subnets, NATs, and private route tables
        pulumi.output(availabilityZones).apply(azs => {
            const usableAzs    = Math.min(azs.names.length, config.azCount);
            const publicCount  = Math.min(config.publicSubnets, usableAzs);
            const privateCount = Math.min(config.privateSubnets, usableAzs);
            const [a, b]       = config.cidrBlock.split("/")[0].split(".");
            const prefixBase   = `${a}.${b}`;

            // Public subnets & NAT EIPs/GWs
            for (let i = 0; i < publicCount; i++) {
                const az       = azs.names[i % usableAzs];
                const pubName  = `${name}-public-${i+1}`;
                const pubCidr  = `${prefixBase}.${i}.0/24`;

                const subnet = new aws.ec2.Subnet(pubName, {
                    vpcId:              this.vpc.id,
                    cidrBlock:          pubCidr,
                    availabilityZone:   az,
                    mapPublicIpOnLaunch:true,
                    tags: {
                        Name: pubName,
                        ...config.tags,
                    },
                }, { parent: this, provider: awsProvider });

                this.publicSubnetIds.push(subnet.id);

                new aws.ec2.RouteTableAssociation(`${pubName}-rt-assoc`, {
                    subnetId:     subnet.id,
                    routeTableId: this.publicRouteTable.id,
                }, { parent: this, provider: awsProvider });

                // Only create enough NAT gateways as you have private subnets (or one)
                if (i < privateCount && (config.natPerPrivateSubnet || i === 0)) {
                    const eip = new aws.ec2.Eip(`${name}-eip-${i+1}`, {
                        vpc: true,
                        tags: {
                            Name: `${config.name}-eip-${i+1}`,
                            ...config.tags,
                        },
                    }, { parent: this, provider: awsProvider });

                    const nat = new aws.ec2.NatGateway(`${name}-nat-${i+1}`, {
                        allocationId: eip.id,
                        subnetId:     subnet.id,
                        tags: {
                            Name: `${config.name}-nat-${i+1}`,
                            ...config.tags,
                        },
                    }, { parent: this, provider: awsProvider });

                    this.natGateways.push(nat);
                }
            }

            // Private subnets & routes via NAT
            for (let i = 0; i < privateCount; i++) {
                const az        = azs.names[i % usableAzs];
                const privName  = `${name}-private-${i+1}`;
                const privCidr  = `${prefixBase}.${100 + i}.0/24`;

                const subnet = new aws.ec2.Subnet(privName, {
                    vpcId:            this.vpc.id,
                    cidrBlock:        privCidr,
                    availabilityZone: az,
                    tags: {
                        Name: privName,
                        ...config.tags,
                    },
                }, { parent: this, provider: awsProvider });

                this.privateSubnetIds.push(subnet.id);

                const rt = new aws.ec2.RouteTable(`${name}-private-rt-${i+1}`, {
                    vpcId: this.vpc.id,
                    tags: {
                        Name: `${config.name}-private-rt-${i+1}`,
                        ...config.tags,
                    },
                }, { parent: this, provider: awsProvider });

                this.privateRouteTables.push(rt);

                new aws.ec2.RouteTableAssociation(`${privName}-rt-assoc`, {
                    subnetId:     subnet.id,
                    routeTableId: rt.id,
                }, { parent: this, provider: awsProvider });

                const natIndex = config.natPerPrivateSubnet ? i : 0;
                if (natIndex < this.natGateways.length) {
                    new aws.ec2.Route(`${name}-private-route-${i+1}`, {
                        routeTableId:         rt.id,
                        destinationCidrBlock: "0.0.0.0/0",
                        natGatewayId:         this.natGateways[natIndex].id,
                    }, { parent: this, provider: awsProvider });
                }
            }
        });

        this.registerOutputs({
            vpcId:            this.vpc.id,
            publicSubnetIds:  this.publicSubnetIds,
            privateSubnetIds: this.privateSubnetIds,
        });
    }
}

// 3) Read your "vpc" namespace config and export a helper
const vpcCfg              = new pulumi.Config("vpc");
const name                = vpcCfg.require("name");
const cidrBlock           = vpcCfg.require("cidrBlock");
const azCount             = vpcCfg.requireNumber("azCount");
const publicSubnets       = vpcCfg.requireNumber("publicSubnets");
const privateSubnets      = vpcCfg.requireNumber("privateSubnets");
const natPerPrivateSubnet = vpcCfg.getBoolean("natPerPrivateSubnet") ?? false;
const tags                = vpcCfg.getObject<{[k:string]:string}>("tags") || {};

/**  
 * Construct and return your VPC from Pulumi config  
 */
export function createVpcFromConfig(): Vpc {
    return new Vpc(name, {
        name,
        cidrBlock,
        azCount,
        publicSubnets,
        privateSubnets,
        natPerPrivateSubnet,
        tags,
    }, { provider: awsProvider });
}

/**
 * For programmatic usage:
 */
export function createVpc(
    name: string,
    cidrBlock: string = "10.0.0.0/16",
    azCount: number = 2,
    publicSubnets: number = 2,
    privateSubnets: number = 2,
    natPerPrivateSubnet: boolean = false,
    tags?: { [key: string]: string }
): Vpc {
    return new Vpc(name, {
        name,
        cidrBlock,
        azCount,
        publicSubnets,
        privateSubnets,
        natPerPrivateSubnet,
        tags,
    }, { provider: awsProvider });
}
