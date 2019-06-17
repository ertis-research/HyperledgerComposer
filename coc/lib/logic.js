/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

/**
 * Add a new case to the chain
 * @param {uma.coc.network.OpenCase} caseData
 * @transaction
 */
function openCase(caseData) {
    // Get current participant
    var currentParticipant = getCurrentParticipant();

    //Check if the participant is an agent
    if (currentParticipant.getFullyQualifiedType() !== 'uma.coc.network.Agent') {
        throw new Error('Only police agents can open a case');
    }

    var badgeNumber = getBadgeNumber(currentParticipant.getFullyQualifiedIdentifier()); //Badge number cause we know that, in this point, we are working w/ an agent
    var factory = getFactory(); //Get the factory
    var caseRegistry = {}; //Global variable for case registry
    var agentRegistry = {}; //Global variable for agent registry

    //Retrieve Case registry
    return getAssetRegistry("uma.coc.network.Case").then((registry) => {
        caseRegistry = registry;
        //CHECK 1 - Is the id given in use?
        return caseRegistry.exists(caseData.id);
    }).then((exists) => {
        if (exists) throw new Error("The id " + caseData.id + " is already in use");

        //Getting the office of this agent
        return getParticipantRegistry("uma.coc.network.Agent");
    }).then((registry) => {
        agentRegistry = registry;
        return agentRegistry.get(badgeNumber);
    }).then((agent) => {
        //CHECK 2 - Only officers and detectives can open a case
        if (!(agent.job == 'OFFICER' || agent.job == 'DETECTIVE')) {
            throw new Error('Only detectives or officers can open a case');
        }

        //ALL CHECKS OK
        //Now i need to retrieve the id of the deposit which office is the same than the agent's
        return query('GetDepositByOffice', { office: agent.office });
    }).then((result) => {
        let deposit_id = result[0].participantId;

        //Create the resource and set the attributes
        let newCase = factory.newResource('uma.coc.network', 'Case', caseData.id);
        newCase.description = caseData.description;
        newCase.openingDate = new Date();
        newCase.status = 'OPENED';
        var rs_agent = factory.newRelationship('uma.coc.network', 'Agent', badgeNumber);
        newCase.openedBy = rs_agent;
        var rs_deposit = factory.newRelationship('uma.coc.network', 'Deposit', deposit_id);
        newCase.participants = [rs_agent, rs_deposit];

        return caseRegistry.add(newCase);
    }).then(() => {
        //Successfull creation
        let event = factory.newEvent('uma.coc.network', 'CaseOpened');
        event.case_id = caseData.id;
        event.openedBy_participant_id = badgeNumber;
        emit(event);
    }).catch((error) => {
        throw new Error(error);
    });
}


/**
 * Close a case
 * @param {uma.coc.network.CloseCase} caseData
 * @transaction
 */
function closeCase(caseData) {
    var currentParticipant = getCurrentParticipant(); //Get current participant
    var caseRegistry = {}; //Global variable for case registry
    var agentRegistry = {}; //Global variable for agent registry
    var evidenceRegistry = {}; //Global variable for evidence registry
    var factory = getFactory(); //Get factory
    var badgeNumber = getBadgeNumber(currentParticipant.getFullyQualifiedIdentifier());
    var deposit_id; //Global variable to store the id of the deposit
    var case_fqi; //Global variable to store the fully qualified identifier of the case
    var case_evidences = []; //Global variable to store the evidences of the case
    var timestamp = new Date();

    //Retrieve case registry
    return getAssetRegistry("uma.coc.network.Case").then((registry) => {
        caseRegistry = registry;
        //CHECK 1 - Does the case exist?
        return caseRegistry.get(caseData.id);
    }).then((caso) => {
        //If the case doesn't exist, we throw an error
        if (!caso) throw new Error("Case " + caseData.id + " not found");

        //CHECK 2 - Is the participant who called this transaction the same who opened the case?
        if (caso.openedBy.getIdentifier() !== badgeNumber) {
            throw new Error("Only agent " + caso.openedBy.getIdentifier() + " can close the case");
        }

        //CHECK 3 - Is the case still opened?
        if (caso.status !== 'OPENED') {
            throw new Error("Case " + caso.caseId + " is already closed");
        }

        //ALL CHECKS OK - We proceed to close the case
        case_fqi = "resource:" + caso.getFullyQualifiedIdentifier();
        caso.status = 'CLOSED';
        caso.resolution = caseData.resolution;
        caso.closureDate = timestamp;
        return caseRegistry.update(caso);
    }).then(() => {
        //Successfull update of the case asset

        //Now we have to assign all the evidences of this case to the deposit of the agent's office
        return getParticipantRegistry("uma.coc.network.Agent");
    }).then((registry) => {
        agentRegistry = registry;
        return agentRegistry.get(badgeNumber);
    }).then((agent) => {
        //I need to retrieve the id of the deposit which office is the same than the agent's
        return query('GetDepositByOffice', { office: agent.office });
    }).then((result) => {
        deposit_id = result[0].participantId;
        //Then, we get all the evidences of the case
        return query('EvidencesByCase', { case_fqi: case_fqi });
    }).then((result) => {
        case_evidences = result;
        return getAssetRegistry("uma.coc.network.Evidence");
    }).then((registry) => {
        evidenceRegistry = registry;
        let evidences = [];
        let rs_new = factory.newRelationship("uma.coc.network", "Deposit", deposit_id);
        for (let i in case_evidences) {
            let evidence = case_evidences[i];
            if (evidence.owner.getIdentifier() != deposit_id) { //If the deposit is the current owner, the transfer is not needed
                let rs_old = factory.newRelationship("uma.coc.network", evidence.owner.getType(), evidence.owner.getIdentifier());
                let concept = factory.newConcept("uma.coc.network", "Owner");
                concept.owner = rs_old;
                concept.till = timestamp;
                evidence.olderOwners.push(concept);
                evidence.owner = rs_new;

                evidences.push(evidence);
            }
        }
        return evidenceRegistry.updateAll(evidences);
    }).then(() => {
        //Successfull update of evidence assets
        let event = factory.newEvent('uma.coc.network', 'CaseClosed');
        event.case_id = caseData.id;
        emit(event);
    }).catch((error) => {
        throw new Error(error);
    });
}

/**
 * Add a participant to a case
 * @param {uma.coc.network.AddParticipant} txData
 * @transaction
 */
function addParticipant(txData) {
    var currentParticipant = getCurrentParticipant(); //Get current participant
    var factory = getFactory(); //Get factory
    var caseRegistry = {}; //Global variable for case registry
    var participantRegistry = {}; //Global variable for PARTICIPANT registry. Can be agent or deposit
    var theCase = {}; //Global variable for the case asset (the one that we want update)

    //Retrieve case registry
    return getAssetRegistry("uma.coc.network.Case").then((registry) => {
        caseRegistry = registry;
        //CHECK 1 - Does the case exist?
        return caseRegistry.get(txData.case_id);
    }).then((caso) => {
        if (!caso) throw new Error("Case " + txData.case_id + " not found");
        theCase = caso;

        //CHECK 2 - Is the case closed?
        if (theCase.status === 'CLOSED') {
            throw new Error("Case " + txData.case_id + " is closed.");
        }

        //CHECK 3 - Did the agent who executed the tx open the case? ONLY THE AGENT WHO OPENED THE CASE CAN ADD OTHER PARTICIPANTS
        let badgeNumber = getBadgeNumber(currentParticipant.getFullyQualifiedIdentifier());
        if (theCase.openedBy.getIdentifier() !== badgeNumber) {
            throw new Error("Only agent " + theCase.openedBy.getIdentifier() + " can add other participants to the case " + txData.case_id);
        }

        //CHECK 4 - Is the new agent already involved in the case?
        if (isParticipantInvolved(theCase.participants, txData.participant_id, txData.participant_type)) {
            throw new Error(txData.participant_type + " " + txData.participant_id + " is already involved in case " + txData.case_id);
        }

        //CHECK 5 - Does the PARTICIPANT who we want to add exist?
        switch (txData.participant_type) {
            case 'AGENT':
                return getParticipantRegistry("uma.coc.network.Agent");
            case 'DEPOSIT':
                return getParticipantRegistry("uma.coc.network.Deposit");
            default:
                throw new Error("Wrong participant type.");
        }

    }).then((registry) => {
        participantRegistry = registry;
        return participantRegistry.get(txData.participant_id);
    }).then((party) => {
        if (!party) throw new Error(txData.participant_type + " " + txData.participant_id + " does not exist");

        //ALL CHECKS OK
        //Create new relationship and add it to the 'participants' attribute
        let relationship;
        switch (txData.participant_type) {
            case 'AGENT':
                relationship = factory.newRelationship("uma.coc.network", "Agent", party.participantId);
                break;
            case 'DEPOSIT':
                relationship = factory.newRelationship("uma.coc.network", "Deposit", party.participantId);
                break;
        }
        theCase.participants.push(relationship);

        //Finally, we have to update the asset
        return caseRegistry.update(theCase);
    }).then(() => {
        //Successfull update
        let event = factory.newEvent("uma.coc.network", "ParticipantAdded");
        event.case_id = txData.case_id;
        event.participant_type = txData.participant_type;
        event.participant_id = txData.participant_id;
        emit(event);
    }).catch((error) => {
        throw new Error(error);
    });
}

/**
 * Add a new evidence to a case
 * @param {uma.coc.network.AddEvidence} evidenceData
 * @transaction
 */
function addEvidence(evidenceData) {
    var currentParticipant = getCurrentParticipant(); //Get current participant

    //Check if the participant is an agent
    if (currentParticipant.getFullyQualifiedType() !== 'uma.coc.network.Agent') {
        throw new Error('Only police agents can upload evidences.');
    }

    var factory = getFactory(); //Get factory
    var caseRegistry = {}; //Global variable for case registry
    var evidenceRegistry = {}; //Global variable for evidence registry
    var badgeNumber = getBadgeNumber(currentParticipant.getFullyQualifiedIdentifier());

    //CHECK 1 - Does the case exist?
    return getAssetRegistry("uma.coc.network.Case").then((registry) => {
        caseRegistry = registry;
        return caseRegistry.get(evidenceData.case_id);
    }).then((caso) => {
        if (!caso) throw new Error("Case " + evidenceData.case_id + " not found");

        //CHECK 2 - Is the case closed?
        if (caso.status === 'CLOSED') {
            throw new Error("Case " + evidenceData.case_id + " is closed.");
        }

        //CHECK 3 - Does the current agent participate in the case?
        if (!isAgentInvolved(caso.participants, badgeNumber)) {
            throw new Error("Agent " + badgeNumber + " is not involved in case " + evidenceData.case_id + ". He/She can not add evidences to this case.");
        }
        //Ok, now we can retrieve evidence registry
        return getAssetRegistry("uma.coc.network.Evidence");

    }).then((registry) => {
        evidenceRegistry = registry;

        //CHECK 4 - Is the id already used?
        return evidenceRegistry.exists(evidenceData.evidence_id);
    }).then((exists) => {
        if (exists) throw new Error("Evidence with id " + evidenceData.evidence_id + " already exists");

        //ALL CHECKS OK
        let evidence = factory.newResource("uma.coc.network", "Evidence", evidenceData.evidence_id);
        evidence.hash = evidenceData.hash;
        evidence.hash_type = evidenceData.hash_type;
        evidence.description = evidenceData.description;
        evidence.extension = evidenceData.extension;
        evidence.additionDate = new Date();
        let agent_rs = factory.newRelationship("uma.coc.network", "Agent", badgeNumber);
        evidence.owner = agent_rs;
        evidence.olderOwners = [];
        let case_rs = factory.newRelationship("uma.coc.network", "Case", evidenceData.case_id);
        evidence.caso = case_rs;

        //Finally we create the asset
        return evidenceRegistry.add(evidence);
    }).then(() => {
        //Evidence created succesfully
        let event = factory.newEvent("uma.coc.network", "EvidenceAdded");
        event.evidence_id = evidenceData.evidence_id;
        event.case_id = evidenceData.case_id;
        event.participant_id = badgeNumber;
        emit(event);
    }).catch((error) => {
        throw new Error(error);
    });
}

/**
 * Transfer an evidence. Only the owner of the evidence can transfer it. The new owner must participate in the case
 * @param {uma.coc.network.TransferEvidence} txData
 * @transaction
 */
function transferEvidence(txData) {
    var currentParticipant = getCurrentParticipant();
    var factory = getFactory();
    var evidenceRegistry = {};
    var caseRegistry = {};
    var theEvidence = {}

    //CHECK 1 - Does the evidence exist?
    return getAssetRegistry("uma.coc.network.Evidence").then((registry) => {
        evidenceRegistry = registry;
        return evidenceRegistry.get(txData.evidence_id);
    }).then((evidence) => {
        if (!evidence) throw new Error("Evidence with id " + txData.evidence_id + "doesn't exist");
        theEvidence = evidence;

        //CHECK 2 - Is the participant who called the tx the evidence's owner?
        if (theEvidence.owner.getIdentifier() !== getBadgeNumber(currentParticipant.getFullyQualifiedIdentifier())) {
            throw new Error("Only the owner of the evidence (participant id:" + theEvidence.owner.getIdentifier() + ") can transfer it");
        }

        //CHECK 3 - Does the new owner participate in the case?
        return getAssetRegistry("uma.coc.network.Case");
    }).then((registry) => {
        caseRegistry = registry;
        return caseRegistry.get(theEvidence.caso.getIdentifier());
    }).then((caso) => {
        if (!isParticipantInvolved(caso.participants, txData.participant_id, txData.participant_type)) {
            throw new Error(txData.participant_type + " " + txData.participant_id + " is not involved in case " + caso.caseId + ". The evidence " + txData.evidence_id + "  can not be transferred.");
        }

        //CHECK 4 - Is the case closed?
        if (caso.status === 'CLOSED') {
            throw new Error("Case " + caso.caseId + " is closed.");
        }

        //ALL CHECKS OK
        let old_owner = factory.newRelationship("uma.coc.network", getParticipantClass(currentParticipant.getFullyQualifiedType()), getBadgeNumber(currentParticipant.getFullyQualifiedIdentifier()));
        let concept = factory.newConcept("uma.coc.network", "Owner");
        concept.owner = old_owner;
        concept.till = new Date();
        theEvidence.olderOwners.push(concept);
        let new_owner;
        switch (txData.participant_type) {
            case 'AGENT':
                new_owner = factory.newRelationship("uma.coc.network", "Agent", txData.participant_id);
                break;
            case 'DEPOSIT':
                new_owner = factory.newRelationship("uma.coc.network", "Deposit", txData.participant_id);
                break;
            default:
                throw new Error("Wrong participant type.");
        }
        theEvidence.owner = new_owner;

        return evidenceRegistry.update(theEvidence);
    }).then(() => {
        let event = factory.newEvent("uma.coc.network", "EvidenceTransferred");
        event.evidence_id = txData.evidence_id;
        event.old_owner_id = getBadgeNumber(currentParticipant.getFullyQualifiedIdentifier());
        event.new_owner_id = txData.participant_id;
        emit(event);
    }).catch((error) => {
        throw new Error(error);
    });
}

//AUXILIAR FUNCTIONS

/**
 * Auxiliar method to get agent's badge number
 * @param {String} fqi
 */
function getBadgeNumber(fqi) {
    let aux = fqi.split("#");
    return aux[1];
}

/**
 * Auxiliar method to get type and id from an owner
 * @param {String} string
 */
function getOwnerTypeAndId(string) {
    let aux = string.split("#");
    let aux2 = aux.split(".");
    let response = [];
    response.push(aux2[3]);
    response.push(aux[1]);
    return response;
}

/**
 * Auxiliar method te get case id
 * @param {String} fqi
 */
function getCaseId(fqi) {
    let aux = fqi.split("#");
    return aux[1];
}

/**
 * Auxiliar method to check if a participant is involved in a case
 * @param {uma.coc.network.Participant[]} participant_list
 * @param {String} participant_id
 * @param {uma.coc.network.ParticipantType} participant_type
 */
function isParticipantInvolved(participant_list, participant_id, participant_type) {
    let aux;
    switch (participant_type) {
        case 'AGENT':
            aux = 'uma.coc.network.Agent#' + participant_id;
            break;
        case 'DEPOSIT':
            aux = 'uma.coc.network.Deposit#' + participant_id;
            break;
    }
    for (let i in participant_list) {
        if (participant_list[i].getFullyQualifiedIdentifier() == aux) return true;
    }
    return false;
}

/**
 * Auxiliar method to check if an agent is involved in a case
 * @param {uma.coc.network.Participant[]} participant_list
 * @param {String} participant_id
 */
function isAgentInvolved(participant_list, participant_id) {
    let aux = "uma.coc.network.Agent#" + participant_id;
    for (let i in participant_list) {
        if (participant_list[i].getFullyQualifiedIdentifier() == aux) return true;
    }
    return false;
}

/**
 * Auxiliar method to get the participant class
 * @param {String} fqt
 */
function getParticipantClass(fqt) {
    switch (fqt) {
        case 'uma.coc.network.Agent':
            return 'Agent';
        case 'uma.coc.network.Deposit':
            return 'Deposit';
    }
}