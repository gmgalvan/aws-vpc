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

Perfect for setting up secure, scalable AWS network infrastructure! 🎯

## ⚙️ Configuration Example

```yaml
config:
  aws:region: us-west-2
  vpc:name: production-vpc
  vpc:cidrBlock: 172.16.0.0/16
  vpc:azCount: 3
  vpc:publicSubnets: 3
  vpc:privateSubnets: 6
  vpc:natPerPrivateSubnet: true
  vpc:tags: |
    {
      "Environment": "Production",
      "Team": "Infrastructure",
      "CostCenter": "Engineering"
    }
```