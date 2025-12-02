
function parseADTimestamp(timestamp) {
    const adEpoch = new Date('1601-01-01T00:00:00Z').getTime();
    const milliseconds = parseInt(timestamp) / 10000;
    return new Date(adEpoch + milliseconds);
}

const timestamps = [
    "133988709133285450", // Adrian
    "134055153964333362", // Alejandro Camps
    "133588532983142823", // Alejandro Gomez
    "134012823041824740"  // Rocio
];

timestamps.forEach(ts => {
    const date = parseADTimestamp(ts);
    console.log(`${ts} -> ${date.toISOString()}`);

    const maxAge = 90;
    const expiryDate = new Date(date.getTime() + maxAge * 24 * 60 * 60 * 1000);
    const now = new Date('2025-12-02T12:00:00Z');
    const daysUntil = Math.floor((expiryDate - now) / (24 * 60 * 60 * 1000));

    console.log(`  Set: ${date.toISOString()}`);
    console.log(`  Expires: ${expiryDate.toISOString()}`);
    console.log(`  Days until: ${daysUntil}`);
});
