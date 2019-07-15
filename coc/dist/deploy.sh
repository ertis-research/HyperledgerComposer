# Create the archive
composer archive create -t dir -n ../ -a archive.bna

# Install the archive
composer network install -a archive.bna -c PeerAdmin@hlfv1

# Start the network
composer network start -n cocv2 -c PeerAdmin@hlfv1 -V 0.0.1 -A admin -S adminpw

# Import the card generated
composer card import -f admin@cocv2.card

# Test the network connection
composer network ping -c admin@cocv2
