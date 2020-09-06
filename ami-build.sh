#!/bin/bash
sudo DEBIAN_FRONTEND=noninteractive apt-get -yq update
sudo DEBIAN_FRONTEND=noninteractive apt-get -yq install build-essential linux-headers-$(uname -r) unzip p7zip-full linux-image-extra-virtual 
sudo DEBIAN_FRONTEND=noninteractive apt-get -yq install python3-pip
pip3 install psutil
sudo DEBIAN_FRONTEND=noninteractive apt-get -yq install awscli

sudo touch /etc/modprobe.d/blacklist-nouveau.conf
sudo bash -c "echo 'blacklist nouveau' >> /etc/modprobe.d/blacklist-nouveau.conf"
sudo bash -c "echo 'blacklist lbm-nouveau' >> /etc/modprobe.d/blacklist-nouveau.conf"
sudo bash -c "echo 'options nouveau modeset=0' >> /etc/modprobe.d/blacklist-nouveau.conf"
sudo bash -c "echo 'alias nouveau off' >> /etc/modprobe.d/blacklist-nouveau.conf"
sudo bash -c "echo 'alias lbm-nouveau off' >> /etc/modprobe.d/blacklist-nouveau.conf"

sudo touch /etc/modprobe.d/nouveau-kms.conf
sudo bash -c "echo 'options nouveau modeset=0' >>  /etc/modprobe.d/nouveau-kms.conf"
sudo update-initramfs -u

cat << EOF > /home/ubuntu/driver-and-hashcat-install.sh
#!/bin/bash
cd /home/ubuntu
wget http://us.download.nvidia.com/tesla/410.104/NVIDIA-Linux-x86_64-410.104.run
sudo /bin/bash NVIDIA-Linux-x86_64-410.104.run --ui=none --no-questions --silent -X
wget https://hashcat.net/files/hashcat-5.1.0.7z
7za x hashcat-5.1.0.7z
git clone https://github.com/Sy14r/HashWrap.git
chmod +x /home/ubuntu/HashWrap/hashwrap
crontab -r
sudo crontab -r
EOF
chmod +x /home/ubuntu/driver-and-hashcat-install.sh
chown ubuntu:ununtu /home/ubuntu/driver-and-hashcat-install.sh
echo "@reboot ( sleep 15; su -c \"/home/ubuntu/driver-and-hashcat-install.sh\" -s /bin/bash ubuntu )" | crontab -
sudo reboot