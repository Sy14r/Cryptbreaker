FROM jshimko/meteor-launchpad:latest
RUN apt-get update && apt-get install -y \
	python \
	python-pip \
	git \
  && git clone https://github.com/SecureAuthCorp/impacket.git \
  && cd impacket \
  && pip install .
