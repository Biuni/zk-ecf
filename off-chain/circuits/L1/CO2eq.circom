pragma circom 2.0.0;

// ======================================================
//  Circuit: CO2eq.circom
// ------------------------------------------------------
//  Computes equivalent CO₂ emissions (CO2eq)
//  from PM10 emissions and verifies they are
//  below the regulatory threshold
// ======================================================

include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/bitify.circom";

template CO2eq(scale, conversionFactorScaled, maxCO2AllowedScaled) {

    // --- PRIVATE INPUTS ---
    signal input pm10;   // PM10 emissions (mg/m^3) [private]

    // --- PUBLIC OUTPUTS ---
    signal output co2eq;   // equivalent CO2 emissions (kg * scale)
    signal output isValid; // 1 if co2eq <= maxCO2Allowed, else 0

    // ======================================================
    // STEP 1. PM10 -> equivalent CO2 conversion
    // ======================================================
    // co2eq = (pm10 * conversionFactorScaled) / scale
    signal scaled_co2eq;
    scaled_co2eq <== pm10 * conversionFactorScaled;
    co2eq <== scaled_co2eq / scale;

    // ======================================================
    // STEP 2. Check regulatory threshold
    // ======================================================
    component le = LessEqThan(128);
    le.in[0] <== co2eq;
    le.in[1] <== maxCO2AllowedScaled;

    isValid <== le.out;
}

// ======================================================
//  INSTANCE EXAMPLE
// ======================================================
// PM10→CO₂eq conversion: 0.00123 (scaled ×100000 = 123)
// Maximum limit: 20 kg (scaled ×1000 = 20000)
component main = CO2eq(10000000, 12300, 20000);
