FROM jshimko/meteor-launchpad:latest
RUN apt-get update && apt-get install -y \
	python \
	python-pip \
	git \
	curl \
  && curl -L https://github.com/SecureAuthCorp/impacket/releases/download/impacket_0_9_20/impacket-0.9.20.tar.gz -o impacket.tar.gz \
  && tar xf impacket.tar.gz \
  && cd impacket-0.9.20 \
  && pip install .
