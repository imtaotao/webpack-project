export async function connect_bluetooth () {
  const device = await navigator.bluetooth.requestDevice({
    filters: [{
      name: 'SMARTCAT'
    }]
  });
  const server = await device.gatt.connect();
  const battery_service = await server.getPrimaryService('battery_service');
  console.log(battery_service)
}

function handle (characteristic) {
  console.log(characteristic)
}