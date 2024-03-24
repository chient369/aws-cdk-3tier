#!/bin/sh
sudo yum update -y
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
source ~/.bashrc
nvm install 16
nvm use 16
version=$(node --version)
cd /home/ec2-user/
aws s3 cp s3://${s3BucketName}/web-tier/ web-tier --recursive
cd /home/ec2-user/web-tier
npm install
npm run build
sudo amazon-linux-extras install nginx1 -y
cd /etc/nginx
sudo rm nginx.conf
sudo aws s3 cp s3://${s3BucketName}/nginx.conf .
sudo sed -i "s/INTERNAL-LB-DNS/${InternalLB}/g" nginx.conf
sudo service nginx restart
chmod -R 755 /home/ec2-user
sudo chkconfig nginx on`