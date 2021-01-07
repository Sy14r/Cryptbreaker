#!/bin/bash
# Colors referenced from axiom by pry0cc - https://github.com/pry0cc/axiom/blob/master/interact/includes/vars.sh

# Reset
Color_Off='\033[0m'       # Text Reset

# Regular Colors
Black='\033[0;30m'        # Black
Red='\033[0;31m'          # Red
Green='\033[0;32m'        # Green
Yellow='\033[0;33m'       # Yellow
Blue='\033[0;34m'         # Blue
Purple='\033[0;35m'       # Purple
Cyan='\033[0;36m'         # Cyan
White='\033[0;37m'        # White

# Bold
BBlack='\033[1;30m'       # Black
BRed='\033[1;31m'         # Red
BGreen='\033[1;32m'       # Green
BYellow='\033[1;33m'      # Yellow
BBlue='\033[1;34m'        # Blue
BPurple='\033[1;35m'      # Purple
BCyan='\033[1;36m'        # Cyan
BWhite='\033[1;37m'       # White

DEPCHECKFAIL=0
DEPENDENCIES=(
	"crontab"
	"docker"
	"docker-compose"
	"wget"
)
INSTALL_PATH="$HOME/.cryptbreaker"
TOOL_NAME="Cryptbreaker"

check_bin_in_path() {
	dep=$1
	if [[ ! $(type -P $1) ]]
	then	
		echo -e "[${BRed}X${Color_Off}] Please install ${BBlue}$1${Color_Off} then run this installation again" 1>&2
		DEPCHECKFAIL=1
	fi
	
}

check_member_of_group() {
	group=$1
	if [[ ! $(id) =~ .*\($group\).* ]]
	then
		echo -e "[${BRed}X${Color_Off}] Please ensure that your account is a member of the ${BBlue}$group${Color_Off} group and then run this installation again" 1>&2
		DEPCHECKFAIL=1
	fi
}

check_dependencies() {
	echo ""
	echo -e "[${BWhite}.${Color_Off}] Checking for Required Dependencies"

	for dep in "${DEPENDENCIES[@]}"
	do
		check_bin_in_path $dep
	done

	check_member_of_group docker

	if [[ $DEPCHECKFAIL -eq 1 ]]
	then
		exit 1
	else
		echo -e "[${BGreen}+${Color_Off}] Required Dependencies Present"
	fi
}

download_files() {
	if [[ -d $INSTALL_PATH ]]
	then
		echo -en "[${BYellow}!${Color_Off}] Existing $TOOL_NAME folder found. Override? [yN]: " 
		read CHOICE
		if [[ $CHOICE =~ ^[Yy]$ ]] 
		then
			echo -e "[${BWhite}.${Color_Off}] Will replace the existing installation"
			rm -rf $INSTALL_PATH
		else
			echo -e "[${BWhite}.${Color_Off}] Will keep current installation, nothing for installer to do"
			exit 0
		fi
	fi
	mkdir -p $INSTALL_PATH
	cd $INSTALL_PATH
	echo -e "[${BWhite}.${Color_Off}] Downloading files..."
	wget https://raw.githubusercontent.com/Sy14r/Cryptbreaker/main/docker-compose.yml 1>&2 2>/dev/null
	echo -e "[${BGreen}+${Color_Off}] Download complete."
}

perform_install() {
	# Crontab autoupdate nightly at midnight
	echo -en "[${BBlue}?${Color_Off}] Would you like to configure for nighlty auto-updates? [yN]: " 
	read CHOICE
	if [[ $CHOICE =~ ^[Yy]$ ]] 
	then
		echo -e "[${BWhite}.${Color_Off}] Configuring for nightly auto-update"
		line="0 0 * * * bash -c \"cd $INSTALL_PATH; docker-compose down; docker-compose pull; docker-compose up -d\""
		(crontab -u $USER -l; echo "$line" ) | crontab -u $USER - 1>&2 2>/dev/null && echo -e "[${BGreen}+${Color_Off}] Autoupdates enabled"
	else
		echo -e "[${BWhite}.${Color_Off}] Not modifying cron for autoupdates"
	fi
	echo -e "[${BWhite}.${Color_Off}] Starting $TOOL_NAME"
	echo -e "[${BWhite}.${Color_Off}] Pulling latest images"
	cd $INSTALL_PATH
	docker-compose pull &>/dev/null
	echo -e "[${BWhite}.${Color_Off}] Launching $TOOL_NAME"
	echo ""
	docker-compose up -d
	echo ""
	echo -e "[${BGreen}+${Color_Off}] $TOOL_NAME successfully installed"
	exit 0
}


check_dependencies
download_files
perform_install
