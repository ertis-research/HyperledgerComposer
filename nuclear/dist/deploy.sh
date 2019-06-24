# Create the BNA
composer archive create -t dir -n ../ -a archive.bna

# Install the BNA
composer network install -a archive.bna -c PeerAdmin@hlfv1

# Start the network
composer network start -n nuclear -c PeerAdmin@hlfv1 -V 0.0.1 -A admin -S adminpw

# Import the card generated
composer card import -f admin@nuclear.card

# Test the network connection
composer network ping -c admin@nuclear
