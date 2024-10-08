let DELTA_T = 1/60.0;
let MILLIS_PER_HOUR = 60.0 * 60.0 * 1000.0;
let MILLIS_PER_MINUTE = 60.0 * 1000.0;
var localLD;
var localSW;


function convertStepsToLight(steps) {
    return steps;
}


function populateLightFromStepsAndSleep(timestamps, steps, sleep) {

    let lengthOfTimestamps = timestamps.length;
    let durationInHours = Math.round((timestamps[lengthOfTimestamps - 1] - timestamps[0]));

    let lightArrayLength = Math.round(durationInHours / DELTA_T);
    localLD = new Array(lightArrayLength + 1);

    for (let i = 0; i < lightArrayLength + 1; i++) {
        localLD[i] = 0;
    }

    for (let i = 0; i < lengthOfTimestamps; i++) {
        for (let index = Math.round(i / (DELTA_T * 60.0)); index < ((i + 1) / (DELTA_T * 60.0)); index++) {

            localLD[index] = localLD[index] + convertStepsToLight(steps[i]) * (MILLIS_PER_MINUTE / MILLIS_PER_HOUR) / DELTA_T;

        }
    }

    
    let sleepArrayLength = Math.round(durationInHours / DELTA_T);
    localSW = new Array(sleepArrayLength + 1);

    for (let i = 0; i < sleepArrayLength + 1; i++) {
        localSW[i] = 0;
    }

    for (let i = 0; i < lengthOfTimestamps; i++) {
        for (let index = Math.round(i / (DELTA_T * 60.0)); index < ((i + 1) / (DELTA_T * 60.0)); index++) {

            localSW[index] = sleep[i];

        }
    }
}


function alphForger(I) {

    let I0 = 9500.0;
    let p = .6;
    let a0 = .16;
    return a0 * (Math.pow(I, p) / Math.pow(I0, p));
}

function alphNonPhotic(I){
    
    let I0 = 9500;
    let p = 0.5;
    let a0 = 0.1;
        
    return a0 * (Math.pow(I / I0, p)) * (I / (I + 100));
}


function clockModel_ForgerSimpler(t, y) {

    let index = Math.round(t / DELTA_T);

    let I = localLD[index];

    let x = y[0];
    let xc = y[1];
    let n = y[2];

    let tx = 24.2;
    let G = 19.875;
    let k = .55;
    let mu = .23;
    let b = 0.013;

    let Bh = G * (1 - n) * alphForger(I);
    let B = Bh * (1 - .4 * x) * (1 - .4 * xc);

    let dydt = [0, 0, 0];

    dydt[0] = Math.PI / 12.0 * (xc + B);
    dydt[1] = Math.PI / 12.0 * (mu * (xc - 4.0 * Math.pow(xc, 3.0) / 3.0) - x * (Math.pow((24.0 / (.99669 * tx)), 2.0) + k * B));
    dydt[2] = 60.0 * (alphForger(I) * (1.0 - n) - b * n);


    return dydt;
}


function clockModel_HilaireNonPhotic(t, y) {

    let index = Math.round(t / DELTA_T);

    let I = localLD[index];
    let sleepWakeStatus = localSW[index];
    
    let x = y[0];
    let xc = y[1];
    let n = y[2];

    let tx = 24.2;
    let G = 37;
    let k = .55;
    let mu = .13;
    let beta = 0.007;
    let q = 1/3;
    let rho = 0.032;

    let C = t % 24;
    let phi_xcx = -2.98;
    let phi_ref = 0.97;
    let CBTmin = phi_xcx + phi_ref;
    CBTmin = CBTmin*24/(2*Math.PI);
    let psi_cx = C - CBTmin;
    psi_cx = psi_cx % 24;

    let Bh = G * (1 - n) * alphNonPhotic(I);
    let B = Bh * (1 - .4 * x) * (1 - .4 * xc);

    // Subtract from 1 to make the sign work
    // From St. Hilaire (2007): sigma equals either 1 (for sleep/rest) or 0 (for wake/activity),
    let sigma = 1 - sleepWakeStatus;
    if (sigma < 1/2){
        sigma = 0;
    }
    else{
        sigma = 1;
    }

    let Nsh = rho * (1/3 - sigma);
    
    if (psi_cx > 16.5 && psi_cx < 21){
        Nsh = rho * (1/3);
    }
    let Ns = Nsh*(1 - Math.tanh(10 * x));

    let dydt = [0, 0, 0];

    dydt[0] = Math.PI / 12.0 * (xc + mu*((1/3)*x + (4/3)*Math.pow(x,3.0) - 256/105*Math.pow(x,7.0)) + B + Ns);
    dydt[1] = Math.PI / 12.0 * (q*B*xc - x*(Math.pow((24/(0.99729*tx)),2) + k*B));
    dydt[2] = 60.0 * (alphNonPhotic(I) * (1.0 - n) - beta * n);
    
    return dydt;
}


function rk4(tot, initialConditions) {

    let dt = DELTA_T;
    let N = Math.round(tot / dt);
    let t = 0;
    let output = new Array(N + 1);

    let w = [initialConditions[0], initialConditions[1], initialConditions[2]];

    output[0] = [w[0], w[1], w[2]];


    for (let i = 0; i < N; i++) {

        let dydt = clockModel_HilaireNonPhotic(t, w);
        let k1 = [dt * dydt[0], dt * dydt[1], dt * dydt[2]];
        let w2 = [w[0] + k1[0] / 2, w[1] + k1[1] / 2, w[2] + k1[2] / 2];
        dydt = clockModel_HilaireNonPhotic(t + dt / 2, w2);
        let k2 = [dt * dydt[0], dt * dydt[1], dt * dydt[2]];
        let w3 = [w[0] + k2[0] / 2, w[1] + k2[1] / 2, w[2] + k2[2] / 2];
        dydt = clockModel_HilaireNonPhotic(t + dt / 2, w3);
        let k3 = [dt * dydt[0], dt * dydt[1], dt * dydt[2]];
        let w4 = [w[0] + k3[0], w[1] + k3[1], w[2] + k3[2]];
        dydt = clockModel_HilaireNonPhotic(t + dt, w4);
        let k4 = [dt * dydt[0], dt * dydt[1], dt * dydt[2]];
        let w5 = [w[0] + (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]) / 6, w[1] + (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]) / 6, w[2] + (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]) / 6];

        w[0] = w5[0];
        w[1] = w5[1];
        w[2] = w5[2];

        t = t + dt;

        output[i + 1] = [w[0], w[1], w[2]];

    }

    return output;
}


export function getCircadianOutput(timestamps, steps, sleep, firstTimestamp) {

    let lengthOfTimestamps = timestamps.length;
    let durationInHours = Math.round((timestamps[lengthOfTimestamps - 1] - timestamps[0]));
    
    populateLightFromStepsAndSleep(timestamps, steps, sleep);
    let initialConditions = getICFromLimitCycleAtTime(firstTimestamp);
        
    let output = rk4(durationInHours, initialConditions);

    return output;
}


function cropOutput(output, numHoursFromEndToInclude) {
    let newOutput = [];
    let counter = 0;
    for (let i = output.length - Math.round(numHoursFromEndToInclude / DELTA_T); i < output.length; i++) {
        newOutput[counter] = output[i];
        counter = counter + 1;
    }
    return newOutput;
}

function getICFromLimitCycleAtTime(time){
    
    var dt = new Date(time * 3600 * 1000); // Convert hours to milliseconds
    let firstTimestampInHoursInUTC = dt.getUTCHours() + dt.getUTCMinutes() / 60.0 ;

    let DT_LIMIT_CYCLE = 0.1;

    let limitCycle = [[ -0.310000, -1.310000, 0.730000],
    [ -0.345821, -1.301471, 0.700016],
    [ -0.381504, -1.292040, 0.671227],
    [ -0.417030, -1.281697, 0.643598],
    [ -0.452393, -1.270443, 0.617114],
    [ -0.487563, -1.258278, 0.591702],
    [ -0.522531, -1.245205, 0.567346],
    [ -0.557272, -1.231229, 0.543995],
    [ -0.591712, -1.216369, 0.521620],
    [ -0.625837, -1.200625, 0.500170],
    [ -0.659632, -1.184001, 0.479607],
    [ -0.693072, -1.166502, 0.459889],
    [ -0.726128, -1.148133, 0.440976],
    [ -0.758518, -1.128944, 0.422863],
    [ -0.790240, -1.108935, 0.405506],
    [ -0.821289, -1.088109, 0.388860],
    [ -0.851609, -1.066476, 0.372888],
    [ -0.881141, -1.044047, 0.357555],
    [ -0.909444, -1.020915, 0.342874],
    [ -0.936462, -0.997092, 0.328809],
    [ -0.962188, -0.972576, 0.315316],
    [ -0.986513, -0.947389, 0.302365],
    [ -1.009333, -0.921553, 0.289927],
    [ -1.030615, -0.895184, 0.278016],
    [ -1.050260, -0.868313, 0.266607],
    [ -1.068149, -0.840944, 0.255662],
    [ -1.084186, -0.813113, 0.245157],
    [ -1.098274, -0.784852, 0.235068],
    [ -1.110801, -0.756254, 0.225405],
    [ -1.121778, -0.727367, 0.216151],
    [ -1.130996, -0.698210, 0.207273],
    [ -1.138430, -0.668827, 0.198755],
    [ -1.144057, -0.639261, 0.190575],
    [ -1.148347, -0.609548, 0.182734],
    [ -1.151533, -0.579730, 0.175222],
    [ -1.153488, -0.549850, 0.168017],
    [ -1.154302, -0.519949, 0.161103],
    [ -1.154162, -0.490034, 0.154474],
    [ -1.153278, -0.460105, 0.148124],
    [ -1.151693, -0.430219, 0.142033],
    [ -1.149527, -0.400407, 0.136191],
    [ -1.146846, -0.370673, 0.130588],
    [ -1.143644, -0.340981, 0.125222],
    [ -1.140086, -0.311387, 0.120075],
    [ -1.136268, -0.281907, 0.115138],
    [ -1.132230, -0.252552, 0.110401],
    [ -1.127737, -0.223283, 0.105865],
    [ -1.123006, -0.194138, 0.101515],
    [ -1.118080, -0.165127, 0.097342],
    [ -1.112998, -0.136260, 0.093337],
    [ -1.107545, -0.107518, 0.089502],
    [ -1.101859, -0.078922, 0.085825],
    [ -1.095951, -0.050477, 0.082297],
    [ -1.089832, -0.022190, 0.078911],
    [ -1.083430, 0.005936, 0.075670],
    [ -1.076781, 0.033894, 0.072564],
    [ -1.069896, 0.061678, 0.069584],
    [ -1.062777, 0.089282, 0.066725],
    [ -1.055428, 0.116700, 0.063980],
    [ -1.047817, 0.143923, 0.061353],
    [ -1.039953, 0.170946, 0.058835],
    [ -1.031840, 0.197762, 0.056420],
    [ -1.023478, 0.224367, 0.054101],
    [ -1.014865, 0.250753, 0.051875],
    [ -1.005969, 0.276910, 0.049744],
    [ -0.996792, 0.302832, 0.047702],
    [ -0.987335, 0.328514, 0.045744],
    [ -0.977593, 0.353948, 0.043864],
    [ -0.967562, 0.379128, 0.042059],
    [ -0.957210, 0.404041, 0.040330],
    [ -0.946527, 0.428679, 0.038674],
    [ -0.935515, 0.453037, 0.037086],
    [ -0.924165, 0.477107, 0.035562],
    [ -0.912468, 0.500882, 0.034098],
    [ -0.900400, 0.524346, 0.032696],
    [ -0.887947, 0.547489, 0.031354],
    [ -0.875105, 0.570305, 0.030066],
    [ -0.861862, 0.592785, 0.028831],
    [ -0.848208, 0.614922, 0.027645],
    [ -0.834128, 0.636702, 0.026506],
    [ -0.818508, 0.658777, 0.031715],
    [ -0.785384, 0.690441, 0.133342],
    [ -0.753679, 0.719772, 0.220182],
    [ -0.723043, 0.747044, 0.294310],
    [ -0.693166, 0.772503, 0.357632],
    [ -0.663817, 0.796339, 0.411757],
    [ -0.634810, 0.818704, 0.458031],
    [ -0.605982, 0.839737, 0.497730],
    [ -0.577270, 0.859498, 0.531582],
    [ -0.548543, 0.878099, 0.560668],
    [ -0.519779, 0.895570, 0.585467],
    [ -0.490908, 0.911977, 0.606713],
    [ -0.461914, 0.927347, 0.624808],
    [ -0.432752, 0.941728, 0.640348],
    [ -0.403425, 0.955130, 0.653569],
    [ -0.373906, 0.967590, 0.664953],
    [ -0.344212, 0.979110, 0.674630],
    [ -0.314330, 0.989715, 0.682969],
    [ -0.284283, 0.999405, 0.690053],
    [ -0.254069, 1.008194, 0.696155],
    [ -0.223714, 1.016083, 0.701336],
    [ -0.193224, 1.023083, 0.705795],
    [ -0.162638, 1.029190, 0.709523],
    [ -0.131964, 1.034415, 0.712713],
    [ -0.101219, 1.038762, 0.715498],
    [ -0.070451, 1.042233, 0.717852],
    [ -0.039693, 1.044831, 0.719846],
    [ -0.008961, 1.046562, 0.721603],
    [ 0.021724, 1.047429, 0.723134],
    [ 0.052343, 1.047436, 0.724405],
    [ 0.082870, 1.046586, 0.725518],
    [ 0.113290, 1.044884, 0.726505],
    [ 0.143636, 1.042335, 0.727314],
    [ 0.173874, 1.038942, 0.728011],
    [ 0.203993, 1.034709, 0.728624],
    [ 0.234002, 1.029641, 0.729128],
    [ 0.263886, 1.023742, 0.729555],
    [ 0.293638, 1.017017, 0.729923],
    [ 0.323229, 1.009472, 0.730217],
    [ 0.352653, 1.001112, 0.730452],
    [ 0.381907, 0.991941, 0.730651],
    [ 0.410980, 0.981962, 0.730827],
    [ 0.439865, 0.971181, 0.730992],
    [ 0.468551, 0.959602, 0.731160],
    [ 0.496968, 0.947243, 0.731272],
    [ 0.525128, 0.934105, 0.731364],
    [ 0.553024, 0.920190, 0.731451],
    [ 0.580640, 0.905506, 0.731540],
    [ 0.607964, 0.890057, 0.731639],
    [ 0.634972, 0.873851, 0.731751],
    [ 0.661500, 0.856929, 0.731815],
    [ 0.687614, 0.839279, 0.731874],
    [ 0.713289, 0.820908, 0.731930],
    [ 0.738500, 0.801824, 0.731985],
    [ 0.763220, 0.782037, 0.732040],
    [ 0.787371, 0.761568, 0.732093],
    [ 0.810724, 0.740480, 0.732126],
    [ 0.833373, 0.718750, 0.732152],
    [ 0.855272, 0.696391, 0.732170],
    [ 0.876376, 0.673417, 0.732182],
    [ 0.896641, 0.649842, 0.732186],
    [ 0.915963, 0.625717, 0.732185],
    [ 0.934219, 0.601108, 0.732181],
    [ 0.951417, 0.575993, 0.732172],
    [ 0.967501, 0.550392, 0.732159],
    [ 0.982415, 0.524328, 0.732141],
    [ 0.996101, 0.497822, 0.732120],
    [ 1.008736, 0.470955, 0.732099],
    [ 1.020331, 0.443768, 0.732079],
    [ 1.030716, 0.416252, 0.732059],
    [ 1.039857, 0.388433, 0.732040],
    [ 1.047718, 0.360338, 0.732022],
    [ 1.054264, 0.331995, 0.732006],
    [ 1.059462, 0.303429, 0.731993],
    [ 1.063674, 0.274688, 0.731982],
    [ 1.067037, 0.245805, 0.731972],
    [ 1.069382, 0.216802, 0.731966],
    [ 1.070738, 0.187708, 0.731963],
    [ 1.071136, 0.158553, 0.731964],
    [ 1.070756, 0.129342, 0.731966],
    [ 1.069757, 0.100082, 0.731968],
    [ 1.068088, 0.070816, 0.731971],
    [ 1.065809, 0.041570, 0.731975],
    [ 1.062981, 0.012369, 0.731980],
    [ 1.059622, -0.016795, 0.731985],
    [ 1.055732, -0.045942, 0.731989],
    [ 1.051405, -0.075023, 0.731993],
    [ 1.046691, -0.104021, 0.731995],
    [ 1.041640, -0.132918, 0.731997],
    [ 1.036229, -0.161715, 0.731998],
    [ 1.030325, -0.190438, 0.731999],
    [ 1.024074, -0.219048, 0.731999],
    [ 1.017500, -0.247534, 0.731998],
    [ 1.010627, -0.275886, 0.731996],
    [ 1.003447, -0.304096, 0.731993],
    [ 0.995820, -0.332175, 0.731992],
    [ 0.987851, -0.360102, 0.731990],
    [ 0.979549, -0.387868, 0.731988],
    [ 0.970918, -0.415464, 0.731986],
    [ 0.961954, -0.442883, 0.731984],
    [ 0.952555, -0.470113, 0.731983],
    [ 0.942789, -0.497147, 0.731981],
    [ 0.932655, -0.523977, 0.731980],
    [ 0.922149, -0.550593, 0.731980],
    [ 0.911270, -0.576988, 0.731980],
    [ 0.900014, -0.603152, 0.731980],
    [ 0.888308, -0.629059, 0.731980],
    [ 0.876190, -0.654710, 0.731979],
    [ 0.863653, -0.680095, 0.731979],
    [ 0.850689, -0.705205, 0.731978],
    [ 0.837293, -0.730029, 0.731978],
    [ 0.823458, -0.754558, 0.731977],
    [ 0.809151, -0.778757, 0.731977],
    [ 0.794380, -0.802629, 0.731977],
    [ 0.779137, -0.826163, 0.731978],
    [ 0.763413, -0.849347, 0.731979],
    [ 0.747200, -0.872170, 0.731980],
    [ 0.730490, -0.894622, 0.731981],
    [ 0.713310, -0.916663, 0.731982],
    [ 0.695634, -0.938297, 0.731982],
    [ 0.677456, -0.959509, 0.731983],
    [ 0.658769, -0.980288, 0.731983],
    [ 0.639568, -1.000619, 0.731982],
    [ 0.619847, -1.020490, 0.731981],
    [ 0.599700, -1.039872, 0.731981],
    [ 0.579081, -1.058757, 0.731981],
    [ 0.557982, -1.077134, 0.731980],
    [ 0.536405, -1.094987, 0.731980],
    [ 0.514352, -1.112302, 0.731980],
    [ 0.491824, -1.129065, 0.731979],
    [ 0.468968, -1.145264, 0.731979],
    [ 0.445727, -1.160882, 0.731979],
    [ 0.422093, -1.175906, 0.731979],
    [ 0.398074, -1.190321, 0.731979],
    [ 0.373681, -1.204113, 0.731979],
    [ 0.348925, -1.217269, 0.731980],
    [ 0.323814, -1.229773, 0.731980],
    [ 0.298489, -1.241634, 0.731981],
    [ 0.272920, -1.252831, 0.731981],
    [ 0.247100, -1.263347, 0.731982],
    [ 0.221048, -1.273170, 0.731982],
    [ 0.194781, -1.282285, 0.731983],
    [ 0.168318, -1.290681, 0.731983],
    [ 0.141677, -1.298345, 0.731984],
    [ 0.114949, -1.305292, 0.731985],
    [ 0.088151, -1.311508, 0.731985],
    [ 0.061291, -1.316978, 0.731986],
    [ 0.034397, -1.321693, 0.731986],
    [ 0.007497, -1.325642, 0.731986],
    [ -0.019402, -1.328838, 0.731986],
    [ -0.046279, -1.331279, 0.731986],
    [ -0.073101, -1.332950, 0.731987],
    [ -0.099844, -1.333844, 0.731987],
    [ -0.126483, -1.333956, 0.731987],
    [ -0.153042, -1.333292, 0.731987],
    [ -0.179543, -1.331859, 0.731987],
    [ -0.205933, -1.329642, 0.731987],
    [ -0.232198, -1.326638, 0.731987],
    [ -0.258323, -1.322845, 0.731986],
    [ -0.284301, -1.318261, 0.731986],
    [ -0.310000, -1.310000, 0.730000]];    

    let index = Math.floor(((firstTimestampInHoursInUTC + 24)  % 24) / DT_LIMIT_CYCLE);
    return limitCycle[index];
}