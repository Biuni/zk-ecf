pragma circom 2.0.0;

// ======================================================
//  Circuit: FuelUse.circom
// ------------------------------------------------------
//  Computes and verifies vehicle fuel consumption
//  based on type and distance
// ======================================================

include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/bitify.circom";

template FuelUse(numTypes, maxDistance, maxFuelAllowed) {

    // --- PRIVATE INPUTS ---
    signal input vehicle_type;
    signal input distance_traveled;

    // --- PUBLIC OUTPUTS ---
    signal output fuel_used;
    signal output isValid;

    // ========================================
    // STEP 1. Efficiency table (liters/km)
    // scale: 100 (e.g. 12 -> 0.12 L/km)
    // ========================================
    var efficiency[numTypes];
    efficiency[0] = 12;   // 0.12 L/km
    efficiency[1] = 20;   // 0.20 L/km
    efficiency[2] = 32;   // 0.32 L/km

    // ========================================
    // STEP 2. Select efficiency
    // ========================================
    component eq[numTypes];
    signal selector[numTypes];

    for (var i = 0; i < numTypes; i++) {
        eq[i] = IsEqual();
        eq[i].in[0] <== vehicle_type;
        eq[i].in[1] <== i;
        selector[i] <== eq[i].out * efficiency[i];
    }

    var tmp = 0;
    for (var j = 0; j < numTypes; j++) {
        tmp += selector[j];
    }
    signal selected_eff;
    selected_eff <== tmp;

    // ========================================
    // STEP 3. Compute fuel consumption
    // fuel_used = (distance * efficiency) / 100
    // ========================================
    signal fuel_scaled;
    fuel_scaled <== distance_traveled * selected_eff;
    fuel_used <== fuel_scaled / 100; // integer division

    // ========================================
    // STEP 4. Check max threshold
    // ========================================
    component le = LessEqThan(128);
    le.in[0] <== fuel_used;
    le.in[1] <== maxFuelAllowed;

    isValid <== le.out;
}

// ======================================================
//  Main instance example
// ======================================================
// 3 vehicle types, max distance 1000 km, threshold 300 L
component main = FuelUse(3, 1000, 300);
