# 🌐 AWS VPC with Pulumi

A configurable AWS VPC infrastructure written in TypeScript and Pulumi.

## ✨ Features

🏗️ **Multi-AZ VPC** - Deploy across multiple availability zones  
🌍 **Public Subnets** - Internet-accessible subnets with IGW  
🔒 **Private Subnets** - Secure subnets with NAT gateway access  
⚡ **Configurable** - Customize CIDR blocks, subnet counts, and more  
🏷️ **Tagging Support** - Consistent resource tagging  

## 🚀 What You Get

- VPC with custom CIDR block
- Internet Gateway for public access
- NAT Gateways for private subnet outbound traffic
- Route tables and associations
- Configurable subnet distribution across AZs

## ⚙️ Configuration Example

```yaml
config:
  aws:region: us-west-2
  vpc:name: demo-vpc
  vpc:cidrBlock: 172.16.0.0/16
  vpc:azCount: 3
  vpc:publicSubnets: 3
  vpc:privateSubnets: 6
  vpc:natPerPrivateSubnet: true
  vpc:tags: |
    {
      "Environment": "Demo",
      "Team": "Infrastructure",
      "CostCenter": "Engineering"
    }
```

This creates:

- 1 VPC with 3 public + 6 private subnets across 3 AZs
- 3 NAT Gateways (one per private subnet)
- All resources tagged for cost tracking