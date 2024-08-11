import { getCircadianOutput } from './models.js';

let DELTA_T = 1 / 60.0;


/*
csv데이터를 가져와 열마다 잘라서 배열에 저장
1. 열마다 자르기
2. 헤더로우 인덱스 저장
3. 열 하나씩 잘라서 데이터 저장
4. 저장된 데이터 반환
*/
function processRawData(raws) {

    //열로 자르기
    let times = [];
    let light = [];
    let counts = [];
    let sleepWake = [];


    for (let i = 0; i < raws.length; i++) {
        const raw = raws[i];

        times[i] = raw.time * 10000.0;
        light[i] = parseFloat(raw.white_light);
        counts[i] = parseFloat(raw.activity);
        sleepWake[i] = raw.sleep;
    }
    return { times, light, counts, sleepWake }
}


/*
데이터 전처리 후 반환
*/
function formatDataForIntegration( times, light, counts, sleepWake) {
    let cumulativeSum = 0;
    let timeInHours = [];
    let lightIndexedByHours = [];
    let countsIndexedByHours = [];
    let combinedIndexedByHours = [];
    let sleepWakeIndexedByHours = [];
    let LIGHT_THRESHOLD = 100;
    let counter = 0;

    for (let i = 0; i < counts.length; i++) {
        //시간 단위로 변환
        let timestamp = (times[i]) / (1000.0 * 3600.0);
        if (isNaN(counts[i])) {
            counts[i] = 0;
        }

        if (isNaN(light[i])) {
            light[i] = 0;
        }

        if (sleepWake[i] == true) {
            sleepWake[i] = parseFloat(1);
        } else if (sleepWake[i] == false) {
            sleepWake[i] = parseFloat(0)
        } else {
            sleepWake[i] = 0
        }

        //정보 저장
        if (!isNaN(timestamp)) {
            cumulativeSum = cumulativeSum + counts[i];
            countsIndexedByHours[counter] = counts[i];
            lightIndexedByHours[counter] = light[i];
            combinedIndexedByHours[counter] = light[i];

            //white light값이 100보다 작고 activity값이 0보다 크면
            if (light[i] < LIGHT_THRESHOLD && counts[i] > 0) {
                combinedIndexedByHours[counter] = counts[i];
            }
            timeInHours[counter] = timestamp;
            sleepWakeIndexedByHours[counter] = sleepWake[i];
            counter = counter + 1
        }
    }


    // Get first valid timestamp
    let firstTimestamp = timeInHours[0];
    for (let i = 0; i < timeInHours.length; i++) {
        timeInHours[i] = timeInHours[i] - firstTimestamp;
    }

    // Resample data to fill any gaps
    //분단위로 변환
    let totalMinutes = 60 * timeInHours[timeInHours.length - 1];

    let minuteByMinuteTime = [];
    let minuteByMinuteModelInput = [];
    let minuteByMinuteSleepWake = [];

    let inputIndexedByHours = combinedIndexedByHours;
    let minuteCounter = 0.0;
    let startTimeForCounts = 0;
    for (let i = 0; i < totalMinutes; i++) {

        // Store current minute (time unit is still hours)
        minuteByMinuteTime[i] = minuteCounter / 60.0;
        let countValue = 0;
        let sleepValue = 0;

        // Interpolate 
        for (let j = startTimeForCounts; j < countsIndexedByHours.length - 1; j++) {

            if (timeInHours[j] * 60 <= minuteCounter && timeInHours[j + 1] * 60 > minuteCounter) {
                let fractionComplete = (minuteCounter / 60.0 - timeInHours[j]) / (timeInHours[j + 1] - timeInHours[j]);
                countValue = inputIndexedByHours[j] + fractionComplete * (inputIndexedByHours[j + 1] - inputIndexedByHours[j]);
                sleepValue = sleepWakeIndexedByHours[j] + fractionComplete * (sleepWakeIndexedByHours[j + 1] - sleepWakeIndexedByHours[j]);
                startTimeForCounts = j;
                break;
            }
        }


        minuteByMinuteModelInput[i] = countValue;
        minuteByMinuteSleepWake[i] = Math.round(sleepValue);

        minuteCounter = minuteCounter + 1.0;

    }

    return { minuteByMinuteTime, minuteByMinuteModelInput, minuteByMinuteSleepWake, firstTimestamp }

}


function getDataForPlot(output, firstTimestamp) {


    let lengthOfDay = 24.0 / DELTA_T;
    let dlmoOffset = 7;


    let minimumTime = -24;
    let minimumValue = 99999999;
    for (let i = output.length - lengthOfDay + 1; i < output.length - 1; i = i + 1) {

        let arrayCurrentStep = output[i];
        let arrayPastStep = output[i - 1];
        let arrayNextStep = output[i + 1];

        if (arrayPastStep[0] > arrayCurrentStep[0] && arrayCurrentStep[0] < arrayNextStep[0]) {
            let tempMinimumTime = i * DELTA_T + (firstTimestamp % 24) - dlmoOffset;
            let tempMinimumValue = arrayCurrentStep[0];

            if (tempMinimumTime > minimumTime + 12) {  // If enough time has passed since the last time
                minimumValue = 99999999;
            }

            if (tempMinimumValue < minimumValue && tempMinimumValue < 0) {
                minimumValue = tempMinimumValue;
                minimumTime = i * DELTA_T;
            }
        }
    }

    var dt = new Date(firstTimestamp * 3600 * 1000); // Convert hours to milliseconds
    let utcHours = dt.getUTCHours() + dt.getUTCMinutes() / 60.0;

    minimumTime = minimumTime + ((utcHours - dlmoOffset + 24) % 24);

    return { minimumTime }
}


export function onmessage(raws) {

    const { times, light, counts, sleepWake } = processRawData(raws);
    
    const { minuteByMinuteTime, minuteByMinuteModelInput, minuteByMinuteSleepWake, firstTimestamp } = formatDataForIntegration( times, light, counts, sleepWake);

    let output = getCircadianOutput(minuteByMinuteTime, minuteByMinuteModelInput, minuteByMinuteSleepWake, firstTimestamp);

    const { minimumTime } = getDataForPlot(output, firstTimestamp);

    return (minimumTime % 24).toFixed(2);

}