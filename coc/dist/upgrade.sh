#!/bin/bash
if [ "$#" -lt 1 ]
then
    echo "Illegal number of parameters."
    echo "Use ./upgrade.sh -h for more info."
    exit 1
fi

while [ -n "$1" ]; do
    case "$1" in
    -v)
        VERSION="$2"
        shift
        ;;
    -h)
        echo "First of all, you have to change the version in ../package.json file."
        echo "Then use ./upgrade.sh -v YOUR_VERSION"
        exit 1
        ;;
    *)
        echo "Option $1 not recognized"
        echo "Use ./upgrade.sh -h for more info."
        exit 1
        ;;
    esac
    shift
done


if [ $VERSION ]
then
    echo "Version: " $VERSION
    # Create the file for new version
    composer archive create -t dir -n ../ -a archive.bna

    # Install the new version
    composer network install -a archive.bna -c PeerAdmin@hlfv1

    # Upgrade the network
    composer network upgrade -n coc -V $VERSION -c PeerAdmin@hlfv1
    
    # Test the network connection
    composer network ping -c admin@coc
fi