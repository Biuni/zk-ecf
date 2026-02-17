pragma circom 2.0.0;

// ======================================================
//  Circuit: PM10.circom
// ------------------------------------------------------
//  Computes particulate emissions (PM10)
//  based on vehicle type and fuel consumed
// ======================================================

include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/bitify.circom";

template PM10(numTypes, maxFuelAllowed, maxPM10Allowed) {

    // --- PRIVATE INPUTS ---
    signal input vehicle_type;  // vehicle type (0..numTypes-1)
    signal input fuel_used;     // fuel consumed (liters)

    // --- PUBLIC OUTPUTS ---
    signal output pm10;         // PM10 emissions (mg/m^3)
    signal output isValid;      // 1 if pm10 <= maxPM10Allowed, else 0

    // ========================================
    // STEP 1. PM10 emission factors
    // (mg PM10 per liter of fuel)
    // ========================================
    var emissionFactor[numTypes];
    // 0: small diesel van
    // 1: medium truck
    // 2: heavy truck
    emissionFactor[0] = 200;  // mg PM10 per liter
    emissionFactor[1] = 320;
    emissionFactor[2] = 500;

    // ========================================
    // STEP 2. Select the correct factor
    // ========================================
    component eq[numTypes];
    signal selectedFactor[numTypes];

    for (var i = 0; i < numTypes; i++) {
        eq[i] = IsEqual();
        eq[i].in[0] <== vehicle_type;
        eq[i].in[1] <== i;
        selectedFactor[i] <== eq[i].out * emissionFactor[i];
    }

    // Sum selected factors
    var tmp = 0;
    for (var j = 0; j < numTypes; j++) {
        tmp += selectedFactor[j];
    }

    signal factor;
    factor <== tmp;

    // ========================================
    // STEP 3. Compute total emissions
    // pm10 = fuel_used * factor
    // ========================================
    pm10 <== fuel_used * factor;

    // ========================================
    // STEP 4. Threshold constraint
    // ========================================
    component le = LessEqThan(128);
    le.in[0] <== pm10;
    le.in[1] <== maxPM10Allowed;

    isValid <== le.out;
}

// ======================================================
//  INSTANCE EXAMPLE
// ======================================================
// 3 vehicle types, max fuel 300 L, threshold 150000 mg PM10
component main = PM10(3, 300, 150000);
