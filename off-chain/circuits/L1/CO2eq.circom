pragma circom 2.0.0;

// ======================================================
//  Circuit: CO2eq.circom
// ------------------------------------------------------
//  Computes equivalent CO₂ emissions (CO2eq)
//  from vehicle type and fuel consumed, and verifies they are
//  below the regulatory threshold
// ======================================================

include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/bitify.circom";

template CO2eq(numTypes, scale, maxCO2Allowed) {

    // --- PRIVATE INPUTS ---
    signal input vehicle_type;  // vehicle type (0..numTypes-1)
    signal input fuel_used;     // fuel consumed (liters)

    // --- PUBLIC OUTPUTS ---
    signal output co2eq;   // equivalent CO2 emissions (kg)
    signal output isValid; // 1 if co2eq <= maxCO2Allowed, else 0

    // ========================================
    // STEP 1. CO2 emission factors
    // scale: 1000 (e.g. 3000 -> 3.0 kg CO2eq/L)
    // ========================================
    var co2EmissionFactor[numTypes];
    // 0: small diesel van
    // 1: medium truck
    // 2: heavy truck
    co2EmissionFactor[0] = 2000;
    co2EmissionFactor[1] = 3000;
    co2EmissionFactor[2] = 4000;

    // ========================================
    // STEP 2. Select the correct factor
    // ========================================
    component eq[numTypes];
    signal selector[numTypes];
    signal selectedFactor[numTypes];

    for (var i = 0; i < numTypes; i++) {
        eq[i] = IsEqual();
        eq[i].in[0] <== vehicle_type;
        eq[i].in[1] <== i;
        selector[i] <== eq[i].out;
        selectedFactor[i] <== selector[i] * co2EmissionFactor[i];
    }

    var factorSum = 0;
    var selectorSum = 0;
    for (var j = 0; j < numTypes; j++) {
        factorSum += selectedFactor[j];
        selectorSum += selector[j];
    }

    signal factor;
    factor <== factorSum;

    signal validVehicleType;
    validVehicleType <== selectorSum;

    // ========================================
    // STEP 3. Compute total CO2-equivalent emissions
    // co2eq = (fuel_used * factor) / scale
    // ========================================
    signal co2eq_scaled;
    co2eq_scaled <== fuel_used * factor;
    co2eq <== co2eq_scaled / scale;

    // ========================================
    // STEP 4. Threshold constraint
    // ========================================
    component le = LessEqThan(128);
    le.in[0] <== co2eq;
    le.in[1] <== maxCO2Allowed;

    isValid <== le.out * validVehicleType;
}

// ======================================================
//  INSTANCE EXAMPLE
// ======================================================
// 3 vehicle types, factor scale 1000, threshold 900 kg CO2eq
component main = CO2eq(3, 1000, 900);
