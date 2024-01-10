// @ts-nocheck
import 'ses'; // adds lockdown, harden, and Compartment
import '@endo/eventual-send/shim.js'; // adds support needed by E

lockdown({
    stackFiltering: 'verbose',
    errorTaming: 'unsafe',
    overrideTaming: 'severe',
    domainTaming: 'unsafe',
});

Error.stackTraceLimit = Infinity;
