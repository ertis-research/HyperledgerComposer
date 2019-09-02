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
 * Register a new tube
 * @param {ertis.uma.nuclear.RegisterTube} txData
 * @transaction
 */
async function registerTube(txData) {
    var currentParticipant = getCurrentParticipant(); // Get current participant
    var participantId = getId(currentParticipant.getFullyQualifiedIdentifier());

    var factory = getFactory(); //Get the factory
    var staffRegistry = {}; //Global variable for staff registry
    var tubeRegistry = {}; //Global variable for tube registry

    //Retrieve Staff registry
    return getParticipantRegistry('ertis.uma.nuclear.Staff').then((registry) => {
        staffRegistry = registry;

        return staffRegistry.get(participantId);
    }).then((staff) => {
        if (!staff) throw new Error("The participant with identifier " + participantId +
            " is not a staff member.");

        if (staff.role === 'ADMIN') {
            //Retrieve Tube registry
            return getAssetRegistry('ertis.uma.nuclear.Tube');
        } else {
            throw new Error("Only an admin can register a tube");
        }
    }).then((registry) => {
        tubeRegistry = registry;

        //Create the asset
        let newTube = factory.newResource('ertis.uma.nuclear', 'Tube', txData.tubeId);
        newTube.posX = txData.posX;
        newTube.posY = txData.posY;
        newTube.length = txData.length;

        return tubeRegistry.add(newTube);
    }).then(() => {
        //Successfull asset creation
    });
}

/**
 * Create a new work
 * @param {ertis.uma.nuclear.CreateWork} workData
 * @transaction
 */
async function createWork(workData) {
    var currentParticipant = getCurrentParticipant(); // Get current participant
    var participantId = getId(currentParticipant.getFullyQualifiedIdentifier());

    var factory = getFactory(); //Get the factory
    var staffRegistry = {}; //Global variable for staff registry
    var workRegistry = {}; //Global variable for work registry

    //Retrieve Staff registry
    return getParticipantRegistry('ertis.uma.nuclear.Staff').then((registry) => {
        staffRegistry = registry;

        return staffRegistry.get(participantId);
    }).then((staff) => {
        if (!staff) throw new Error("The participant with identifier " + participantId +
            " is not a staff member.");

        if (staff.role === 'ADMIN') {
            //Retrieve Work registry
            return getAssetRegistry('ertis.uma.nuclear.Work');
        } else {
            throw new Error("Only an admin can create a new work");
        }
    }).then((registry) => {
        workRegistry = registry;

        //Add the resource 'Work'
        let newWork = factory.newResource('ertis.uma.nuclear', 'Work', workData.workId);
        newWork.workDate = new Date();
        newWork.state = "PLANNED";
        newWork.description = workData.description;

        return workRegistry.add(newWork);
    }).then(() => {
        //Successfull asset creation
    });
}

/**
 * Close a work. All the calibrations of this work must be finished
 * @param {ertis.uma.nuclear.CloseWork} txData 
 * @transaction
 */
async function closeWork(txData) {
    var currentParticipant = getCurrentParticipant(); // Get current participant
    var participantId = getId(currentParticipant.getFullyQualifiedIdentifier());

    var staffRegistry = {}; //Global variable for staff registry
    var workRegistry = {}; //Global variable for work registry
    var work = {}; //Global variable for the work we want to close

    //Get staff registry
    return getParticipantRegistry('ertis.uma.nuclear.Staff').then((registry) => {
        staffRegistry = registry;

        return staffRegistry.get(participantId);
    }).then((staff) => {
        if (!staff) throw new Error("The participant with identifier " + participantId +
            " is not a staff member.");

        if (staff.role === 'ADMIN') {
            //Get work registry
            return getAssetRegistry('ertis.uma.nuclear.Work');
        } else {
            throw new Error("Only an admin can close a work");
        }
    }).then((registry) => {
        workRegistry = registry;

        return workRegistry.get(txData.workId);
    }).then((wrk) => {
        if (!wrk) throw new Error("Work with identifier " + txData.workId + "does not exist.");

        work = wrk;
        //Get all the calibrations of this work
        let work_fqi = "resource:" + work.getFullyQualifiedIdentifier();
        return query('CalibrationsByWork', { work_fqi: work_fqi });
    }).then((result) => {
        //Check if all the calibrations of this work are finished (3 analysis completed)-
        result.forEach((element) => {
            if (element.resolutionState !== 'FINISHED') {
                throw new Error("At least one of the calibrations of this work is not finished");
            }
        });

        //All the calibrations are finished
        work.state = 'FINISHED';
        return workRegistry.update(work);
    }).then(() => {
        //Successfull asset update
    });
}

/**
 * Add a new calibration
 * @param {ertis.uma.nuclear.AddCalibration} txData
 * @transaction
 */
async function addCalibration(txData) {
    var currentParticipant = getCurrentParticipant(); // Get current participant
    var participantId = getId(currentParticipant.getFullyQualifiedIdentifier());

    var factory = getFactory(); //Get the factory
    var staffRegistry = {}; //Global variable for staff registry
    var workRegistry = {}; //Global variable for work registry
    var work = {}; //Global variable for the work we want to modify
    var calibrationRegistry = {}; //Global variable for calibration registry

    //Get staff registry
    return getParticipantRegistry('ertis.uma.nuclear.Staff').then((registry) => {
        staffRegistry = registry;

        return staffRegistry.get(participantId);
    }).then((staff) => {
        if (!staff) throw new Error("The participant with identifier " + participantId +
            " is not a staff member.");

        if (staff.role === 'ADMIN') {
            //Get work registry
            return getAssetRegistry('ertis.uma.nuclear.Work');
        } else {
            throw new Error("Only an admin can add a new calibration");
        }
    }).then((registry) => {
        workRegistry = registry;

        return workRegistry.get(txData.workId);
    }).then((wrk) => {
        if (!wrk) throw new Error('Work with identifier ' + txData.workId + 'does not exist.');

        work = wrk;
        return getAssetRegistry('ertis.uma.nuclear.Calibration');
    }).then((registry) => {
        calibrationRegistry = registry;

        let newCal = factory.newResource('ertis.uma.nuclear', 'Calibration', txData.calId);
        newCal.calDate = new Date();
        newCal.equipment = txData.equipment;
        newCal.primaryState = "NOT_ASSIGNED";
        newCal.secondaryState = "NOT_ASSIGNED";
        newCal.resolutionState = "NOT_ASSIGNED";
        let workRel = factory.newRelationship('ertis.uma.nuclear', 'Work', txData.workId);
        newCal.work = workRel;

        return calibrationRegistry.add(newCal);
    }).then(() => {
        //Successfull asset creation (calibration)

        let work_fqi = "resource:" + work.getFullyQualifiedIdentifier();
        return query('CalibrationsByWork', { work_fqi: work_fqi });
    }).then((response) => {
        if (response.length === 0) { //Change work state
            work.state = "WORK_IN_PROGRESS";
            return workRegistry.update(work);
        }
    }).then(() => {
        //Sucessfull asset update (work)
    });
}

/**
 * An analyst or advanced analyst can take a calibration
 * @param {ertis.uma.nuclear.GetCalibration} txData
 * @transaction
 */
async function getCalibration(txData) {
    var currentParticipant = getCurrentParticipant(); // Get current participant
    var participantId = getId(currentParticipant.getFullyQualifiedIdentifier());

    var factory = getFactory(); //Get the factory
    var calibrationRegistry = {}; //Global variable for calibration registry
    var calibration = {}; //Global variable for the calibration itself
    var staffRegistry = {}; //Global variable for staff registry

    //Get calibration registry
    return getAssetRegistry('ertis.uma.nuclear.Calibration').then((registry) => {
        calibrationRegistry = registry;

        return calibrationRegistry.get(txData.calId);
    }).then((calib) => {
        if (!calib) throw new Error("Calibration with identifier " + txData.calId + " does not exist");
        calibration = calib;

        //Get acquisitions of this calibration
        let cal_fqi = "resource:" + calibration.getFullyQualifiedIdentifier();
        return query('AcquisitionsByCalibration', { cal_fqi: cal_fqi });
    }).then((results) => {
        //Check the number of acquisitions of this calibration
        if (results.length === 0) throw new Error("You can not assign a calibration with zero acquisitions. Try it later.");

        //Get staff registry
        return getParticipantRegistry('ertis.uma.nuclear.Staff');
    }).then((registry) => {
        staffRegistry = registry;

        return staffRegistry.get(participantId);
    }).then((staff) => {
        if (!staff) throw new Error("The participant with identifier " + participantId +
            " is not a staff member.");

        if (!(staff.role == 'ANALYST' || staff.role == 'ADVANCED_ANALYST')) {
            throw new Error("Only an analyst or an advanced analyst can take a calibration.");
        }

        switch (txData.type) {
            case 'PRIMARY':
                if (staff.role === 'ANALYST' && calibration.primaryState === 'NOT_ASSIGNED') {
                    calibration.primaryState = 'WORK_IN_PROGRESS';
                    let rs = factory.newRelationship('ertis.uma.nuclear', 'Staff', participantId);
                    calibration.primaryAnalyst = rs;
                } else {
                    throw new Error("Error...");
                }
                break;
            case 'SECONDARY':
                if (staff.role === 'ANALYST' && calibration.secondaryState === 'NOT_ASSIGNED') {
                    calibration.secondaryState = 'WORK_IN_PROGRESS';
                    let rs = factory.newRelationship('ertis.uma.nuclear', 'Staff', participantId);
                    calibration.secondaryAnalyst = rs;
                } else {
                    throw new Error("Error...");
                }
                break;
            case 'RESOLUTION':
                if (staff.role === 'ADVANCED_ANALYST' && calibration.primaryState === 'FINISHED' &&
                    calibration.secondaryState === 'FINISHED') {

                    calibration.resolutionState = 'WORK_IN_PROGRESS';
                    let rs = factory.newRelationship('ertis.uma.nuclear', 'Staff', participantId);
                    calibration.advancedAnalyst = rs;
                } else {
                    throw new Error("A resolution analysis can only be assigned when primary " +
                        "and secondary analysis are finished. In addition, it can only be assigned to an advanced analyst.");
                }
                break;
            default:
                throw new Error("Invalidad analysis type");
        }

        return calibrationRegistry.update(calibration);
    }).then(() => {
        //Successfull asset update
    });
}

/**
 * An analyst or advanced analyst can take a calibration
 * @param {ertis.uma.nuclear.EndCalibration} txData
 * @transaction
 */
async function endCalibration(txData) {
    var currentParticipant = getCurrentParticipant(); // Get current participant
    var participantId = getId(currentParticipant.getFullyQualifiedIdentifier());

    var calibrationRegistry = {}; //Global variable for calibration registry
    var calibration = {}; //Global variable for the calibration the participant wants to finish

    //Get staff registry
    return getAssetRegistry('ertis.uma.nuclear.Calibration').then((registry) => {
        calibrationRegistry = registry;

        return calibrationRegistry.get(txData.calId);
    }).then((cal) => {
        if (!cal) throw new Error("Calibration with identifier " + txData.calId + " does not exist");

        calibration = cal;
        switch (txData.type) {
            case 'PRIMARY':
                if (cal.primaryAnalyst !== undefined && cal.primaryAnalyst.getFullyQualifiedIdentifier() === currentParticipant.getFullyQualifiedIdentifier()) {
                    let cal_fqi = "resource:" + calibration.getFullyQualifiedIdentifier();
                    return query("AcquisitionsByCalibration", { cal_fqi: cal_fqi });
                } else {
                    throw new Error("Only the primary analyst can finalize the primary analysis");
                }
            case 'SECONDARY':
                if (cal.secondaryAnalyst !== undefined && cal.secondaryAnalyst.getFullyQualifiedIdentifier() === currentParticipant.getFullyQualifiedIdentifier()) {
                    let cal_fqi = "resource:" + calibration.getFullyQualifiedIdentifier();
                    return query("AcquisitionsByCalibration", { cal_fqi: cal_fqi });
                } else {
                    throw new Error("Only the secondary analyst can finalize the secondary analysis");
                }
            case 'RESOLUTION':
                if (cal.advancedAnalyst !== undefined && cal.advancedAnalyst.getFullyQualifiedIdentifier() === currentParticipant.getFullyQualifiedIdentifier()) {
                    let cal_fqi = "resource:" + calibration.getFullyQualifiedIdentifier();
                    return query("AcquisitionsByCalibration", { cal_fqi: cal_fqi });
                } else {
                    throw new Error("Only the advance analyst can finalize the resolution");
                }
            default:
                throw new Error("Invalid analysis type");
        }
    }).then(async(results) => {
        //Must exist one analysis of this participant for each acquisition
        let exists;
        for (let element of results) {
            let acq_fqi = "resource:" + element.getFullyQualifiedIdentifier();
            let an_fqi = "resource:" + currentParticipant.getFullyQualifiedIdentifier();
            exists = await existsAnalysis(acq_fqi, an_fqi);
            if (!exists) throw new Error("At least one acquisition has not been analyzed. You must analyze all acquisitions of the calibration to finish it.")
        }

        //All the acquisitions have been analyzed by this participant. The calibration for him/her can be closed.
        switch (txData.type) {
            case 'PRIMARY':
                calibration.primaryState = 'FINISHED';
                break;
            case 'SECONDARY':
                calibration.secondaryState = 'FINISHED';
                break;
            case 'RESOLUTION':
                calibration.resolutionState = 'FINISHED';
                break;
        }

        return calibrationRegistry.update(calibration);
    }).then(() => {
        //Successfull asset update
    })
}

/**
 * Add a new acquisition
 * @param {ertis.uma.nuclear.AddAcquisition} txData
 * @transaction
 */
async function addAcquisition(txData) {
    var currentParticipant = getCurrentParticipant(); // Get current participant
    var participantId = getId(currentParticipant.getFullyQualifiedIdentifier());

    try {
        //1. Check if participant is an acquisitor
        let staffRegistry = await getParticipantRegistry('ertis.uma.nuclear.Staff');
        let staff = await staffRegistry.get(participantId);

        if (!staff) throw new Error("You are not a staff member.");
        if (staff.role !== 'ACQUISITOR') throw new Error("Only an acquisitor can execute this tx.");

        //2. Check if calibration exists
        let calibrationRegistry = await getAssetRegistry('ertis.uma.nuclear.Calibration');
        let exists = await calibrationRegistry.exists(txData.calId);

        if (!exists) throw new Error("Calibration with identifier " + txData.calId + " does not exist");

        //3. Check if tube exists
        let tubeRegistry = await getAssetRegistry('ertis.uma.nuclear.Tube');
        let tube = await tubeRegistry.get(txData.tubeId);

        if (!tube) throw new Error("Tube with identifier " + txData.tubeId + " does not exist");

        //ALL CHECKS OK - Retrieve acquisition registry
        let acquisitionRegistry = await getAssetRegistry('ertis.uma.nuclear.Acquisition');

        //Get the factory
        let factory = getFactory();

        //New asset of type 'Acquisition'
        let newAcq = factory.newResource('ertis.uma.nuclear', 'Acquisition', txData.acqId);
        newAcq.acqDate = new Date();
        newAcq.filename = txData.filename;
        newAcq.hash = txData.hash;
        let rs_tube = factory.newRelationship('ertis.uma.nuclear', 'Tube', txData.tubeId);
        newAcq.tube = rs_tube;
        let rs_acquisitor = factory.newRelationship('ertis.uma.nuclear', 'Staff', participantId);
        newAcq.acquisitor = rs_acquisitor;
        let rs_cal = factory.newRelationship('ertis.uma.nuclear', 'Calibration', txData.calId);
        newAcq.calibration = rs_cal;

        //Adding the new asset to the registry
        await acquisitionRegistry.add(newAcq);

        //Emit event
        let event = factory.newEvent('ertis.uma.nuclear', 'AcquisitionAdded');
        event.acqId = txData.acqId;
        event.filename = txData.filename;
        event.hash = txData.hash;
        emit(event);

    } catch (error) {
        console.log(error);
    }

}

/**
 * Add a new analysis
 * @param {ertis.uma.nuclear.AddAnalysis} txData
 * @transaction
 */
async function addAnalysis(txData) {
    var currentParticipant = getCurrentParticipant(); // Get current participant
    var participantId = getId(currentParticipant.getFullyQualifiedIdentifier());

    var factory = getFactory(); //Get the factory
    var staffRegistry = {}; //Global variable for staff registry
    var acquisitionRegistry = {}; //Global variable for acquisition registry
    var analysisRegistry = {}; //Global variable for analysis registry

    return getParticipantRegistry('ertis.uma.nuclear.Staff').then((registry) => {
        staffRegistry = registry;

        return staffRegistry.get(participantId);
    }).then((staff) => {
        if (!staff) throw new Error("You are not a staff member.");

        if (!(staff.role == 'ANALYST' || staff.role == 'ADVANCED_ANALYST')) {
            throw new Error("Only an analyst or an advanced analyst can execute this tx.");
        }

        return getAssetRegistry('ertis.uma.nuclear.Acquisition');
    }).then((registry) => {
        acquisitionRegistry = registry;

        return acquisitionRegistry.exists(txData.acqId);
    }).then((exists) => {
        if (!exists) throw new Error("Acquisition with identifier " + txData.acqId + " does not exist");

        //Get analysis made by this participant and associated to this acquisition
        let acq_fqi = "resource:ertis.uma.nuclear.Acquisition#" + txData.acqId;
        let an_fqi = "resource:" + currentParticipant.getFullyQualifiedIdentifier();
        return query('AnalysisByAcquisitionAndAnalyst', { acq_fqi: acq_fqi, an_fqi: an_fqi });

    }).then((results) => {
        if (results.length !== 0) throw new Error("You have already analyzed this acquisition (acq id: " + txData.acqId + ").");

        return getAssetRegistry('ertis.uma.nuclear.Analysis');
    }).then((registry) => {
        analysisRegistry = registry;

        let newAnalysis = factory.newResource('ertis.uma.nuclear', 'Analysis', txData.analysisId);
        newAnalysis.analysisDate = new Date();
        newAnalysis.method = 'MANUAL';
        newAnalysis.indications = txData.indications;
        let rs_acq = factory.newRelationship('ertis.uma.nuclear', 'Acquisition', txData.acqId);
        newAnalysis.acquisition = rs_acq;
        let rs_analyst = factory.newRelationship('ertis.uma.nuclear', 'Staff', participantId);
        newAnalysis.analyst = rs_analyst;

        return analysisRegistry.add(newAnalysis);
    }).then(() => {
        //Successfull asset creation
    });
}

/**
 * Add a new automatic analysis
 * @param {ertis.uma.nuclear.AddAutomaticAnalysis} txData
 * @transaction
 */
async function addAutomaticAnalysis(txData) {
    let currentParticipant = getCurrentParticipant(); // Get current participant

    if (currentParticipant.getFullyQualifiedType() !== 'ertis.uma.nuclear.Staff') {
        throw new Error("Only staff members can execute transactions");
    }
    let participantId = getId(currentParticipant.getFullyQualifiedIdentifier());

    try {
        let staffRegistry = await getParticipantRegistry('ertis.uma.nuclear.Staff');
        let staff = await staffRegistry.get(participantId);
        if (!staff) throw new Error(`Participant with identifier ${participantId} does not exist.`);
        if (staff.role !== 'AUTO') throw new Error("Staff must have role \'AUTO\' to execute this transaction");

        let acqRegistry = await getAssetRegistry('ertis.uma.nuclear.Acquisition');
        let acq = await acqRegistry.get(txData.acqId);
        if (!acq) throw new Error(`Acquisition with identifier ${txData.acqId} does not exist`);

        let analysisRegistry = await getAssetRegistry('ertis.uma.nuclear.Analysis');
        let factory = getFactory();
        let newAnalysis = factory.newResource('ertis.uma.nuclear', 'Analysis', txData.analysisId);
        newAnalysis.analysisDate = new Date();
        newAnalysis.method = 'AUTOMATIC';
        newAnalysis.indications = automaticAnalysis(txData.acqData, acq.tube.length);
        let rs_acq = factory.newRelationship('ertis.uma.nuclear', 'Acquisition', txData.acqData);
        newAnalysis.acquisition = rs_acq;
        let rs_staff = factory.newRelationship('ertis.uma.nuclear', 'Staff', participantId);
        newAnalysis.analyst = rs_staff;

        await analysisRegistry.add(newAnalysis);

    } catch (e) {
        console.log(e);
    }

}

/**
 * Auxiliar method to get identifiers
 * @param {String} fqi
 */
function getId(fqi) {
    let aux = fqi.split("#");
    return aux[1];
}

/**
 * Auxiliar method to verify is exists one analysis made by one specific analyst from an acquisition
 * @param {String} acq_fqi
 * @param {String} an_fqi
 */
async function existsAnalysis(acq_fqi, an_fqi) {
    let response = await query('AnalysisByAcquisitionAndAnalyst', { acq_fqi: acq_fqi, an_fqi: an_fqi });
    if (response.length === 0) {
        return false;
    } else {
        return true;
    }
}

/**
 * Automatic analysis
 * @param {String[]} data
 * @param {Double} tubeLength
 * @returns {String[]}
 */
function automaticAnalysis(data, tubeLength) {
    let total = 0;
    data.forEach((element) => {
        total += parseInt(element);
    });
    let n_indications = Math.round(total / data.length) % 4;

    let indications = [];
    for (let i = 0; i < n_indications; i++) {
        let indication = "Detected ";
        switch (Math.floor(Math.random() * 3)) {
            case 0:
                indication += "fissure"; //Grieta
                break;
            case 1:
                indication += "break"; //Rotura
                break;
            case 2:
                indication += "dent"; //Abolladura
                break;
        }
        //Random position
        let pos = Math.random() * tubeLength;

        indication += `, position ${pos}`;

        //Add indication
        indications.push(indication);
    }

    return indications;
}