/// import * as Autodesk from "@types/forge-viewer";

async function getAccessToken(callback) {
    try {
        const resp = await fetch('/api/auth/token');
        if (!resp.ok) {
            throw new Error(await resp.text());
        }
        const { access_token, expires_in } = await resp.json();
        callback(access_token, expires_in);
    } catch (err) {
        alert('Could not obtain access token. See the console for more details.');
        console.error(err);
    }
}

export function initViewer(container) {
    return new Promise(function (resolve, reject) {
        Autodesk.Viewing.Initializer({ env: 'AutodeskProduction', getAccessToken }, function () {
            const config = {
                extensions: ['Autodesk.DocumentBrowser']
            };
            const viewer = new Autodesk.Viewing.GuiViewer3D(container, config);
            viewer.start();
            viewer.setTheme('light-theme');
            resolve(viewer);
        });
    });
}

export function loadModel(viewer, urn) {
    return new Promise(function (resolve, reject) {
        function onDocumentLoadSuccess(doc) {
            resolve(viewer.loadDocumentNode(doc, doc.getRoot().getDefaultGeometry()));
            // 1. Listen for the native APS selection change event
            viewer.addEventListener(Autodesk.Viewing.SELECTION_CHANGED_EVENT, onSelectionChanged);

            function onSelectionChanged(event) {
                const outputDiv = document.getElementById('property-output');

                // Check if anything was actually selected (the array will have lengths > 0)
                if (event.dbIdArray && event.dbIdArray.length > 0) {
                    const selectedId = event.dbIdArray[0]; // Get the first selected item ID

                    outputDiv.innerHTML = "<em>Loading properties from BIM database...</em>";

                    // 2. Fetch the rich Revit properties using the item's dbId
                    viewer.getProperties(selectedId, function (data) {
                        // Success Callback: 'data' contains the complete Revit property dictionary
                        displayProperties(data, outputDiv);
                    }, function (error) {
                        // Error Callback
                        outputDiv.innerHTML = "Error retrieving properties.";
                        console.error(error);
                    });
                } else {
                    // If the user clicked into empty space to clear their selection
                    outputDiv.innerHTML = "No object selected.";
                }
            }

            // 3. Helper function to clean up and display the raw properties object
            function displayProperties(bimData, targetElement) {
                let html = `<strong>Name:</strong> ${bimData.name}<br>`;
                html += `<strong>Database ID:</strong> ${bimData.dbId}<br><hr>`;
                html += `<h4>Revit Parameters:</h4><ul style="list-style: none; padding-left: 0;">`;

                // Loop through the array of properties attached to this object
                bimData.properties.forEach(prop => {
                    // Filter out empty rows or hidden internal parameters for a cleaner look
                    if (prop.displayValue !== "" && prop.displayName) {
                        html += `<li style="margin-bottom: 5px;">
                        <small style="color: #666;">[${prop.displayCategory}]</small><br>
                        <strong>${prop.displayName}:</strong> ${prop.displayValue}
                    </li>`;
                    }
                });

                html += `</ul>`;
                targetElement.innerHTML = html;
            }
        }
        function onDocumentLoadFailure(code, message, errors) {
            reject({ code, message, errors });
        }
        viewer.setLightPreset(0);
        Autodesk.Viewing.Document.load('urn:' + urn, onDocumentLoadSuccess, onDocumentLoadFailure);
    });
}