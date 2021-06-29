import {
    resolveNodeId,
    AttributeIds,
    OPCUAClient,
    ClientSubscription,
    DataValue,
    BrowseResult,
    ReferenceDescription,
    OPCUABaseServer,
    TimestampsToReturn,
    DataType,
    ClientSession
} from "node-opcua";
import {
    Tedis,
    TedisPool
} from "tedis";

var opcuaSession;
const opcuaClient = OPCUAClient.create({
    endpoint_must_exist: false,
    connectionStrategy: {
        maxRetry: 3,
        initialDelay: 2000,
        maxDelay: 10 * 1000
    }
});

const tedis = new Tedis({
    port: 6379,
    host: "127.0.0.1"
});

const endpointUrl = "opc.tcp://mua-notebook:26543/MUA/MyLittleServer";
const nodeId = resolveNodeId("ns=1;b=1020FFAA");

const appStartTime = new Date();
var previousDbValue = -1;

class App {
    /** Entry point of our app */
    public static start() {
        Opcua.init();
        var intervalID = setInterval(function(){Redis.checkForValue();}, 1000);
    }
}

class Redis {
    public static async checkForValue() {
        try {
            var dbValue = await tedis.get("PPE_IS_OK_FOR_DOOR"); // expected values [0, 1]
            if (dbValue != previousDbValue) {
                previousDbValue = dbValue;
                Opcua.changeValue(dbValue == 1);
            }
        }
        catch (err) {
            console.log("Redis Error !!!", err);
        }
    }
}

class Opcua {
    public static async init() {
        opcuaClient.on("backoff", () => console.log("retrying connection"));
        await opcuaClient.connect(endpointUrl);
    }

    public static async dispose() {
        if (opcuaSession) {
            //console.log(" closing session");
            await opcuaSession.close();
        }

        if (opcuaClient) {
            await opcuaClient.disconnect();
        }
    }

    private static async getSession() {
        if (!opcuaSession) {
            opcuaSession = await opcuaClient.createSession();
        }
    }

    public static async changeValue(nodeValue: boolean) {
        try {
            //console.log("opcua started with value = " + nodeValue);

            await this.getSession();
    
            const nodesToWrite = [
                {
                    nodeId,
                    attributeId: AttributeIds.Value,
                    value: {
                        value: {
                            dataType: DataType.Boolean,
                            value: nodeValue
                        }
                    }
                }
            ];

            opcuaSession.write(nodesToWrite, function (err, statusCode) {
                if (err) {
                    console.log("Session write error : " + err.message + "/nstatusCode: " + statusCode);
                }
            });

            const dataValueEdited = await opcuaSession.read({ nodeId, attributeId: AttributeIds.Value });
            console.log("nodeValueEdited: " + dataValueEdited.value.value + "       " + (new Date().getTime() - appStartTime.getTime() / 1000) + "seconds");
            
            await new Promise((resolve) => setTimeout(resolve, 10000));
        }
        catch (err) {
            console.log("Opcua Error !!!", err);
        }
    
    }
}

App.start();
