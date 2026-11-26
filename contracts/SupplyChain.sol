// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract SupplyChain {
    address public Owner;

    constructor() {
        Owner = msg.sender;
    }

    modifier onlyByOwner() {
        require(msg.sender == Owner, "Only the owner can perform this action");
        _;
    }

    enum STAGE {
        Init,
        RawMaterialSupply,
        Manufacture,
        Distribution,
        Retail,
        Sold
    }

    event ParticipantAdded(string role, uint256 indexed id, address indexed addr, string name);
    event BatteryAdded(uint256 indexed id, string name);
    event StageChanged(uint256 indexed batteryId, STAGE stage, address indexed by);

    uint256 public batteryCtr = 0;
    uint256 public rmsCtr = 0;
    uint256 public manCtr = 0;
    uint256 public disCtr = 0;
    uint256 public retCtr = 0;

    struct battery {
        uint256 id; //unique battery id
        string name; //name of the battery
        string description; //about battery
        uint256 RMSid; //id of the Raw Material supplier for this particular battery
        uint256 MANid; //id of the Manufacturer for this particular battery
        uint256 DISid; //id of the distributor for this particular battery
        uint256 RETid; //id of the retailer for this particular battery
        STAGE stage; //current battery stage
    }

    mapping(uint256 => battery) public BatteryStock;

    //Every role shares the same shape
    struct participant {
        address addr;
        uint256 id; //participant id within its role
        string name; //Name of the participant
        string place; //Place the participant is based in
    }

    mapping(uint256 => participant) public RMS;
    mapping(uint256 => participant) public MAN;
    mapping(uint256 => participant) public DIS;
    mapping(uint256 => participant) public RET;

    //Reverse lookups (address => id) so role checks don't loop over every participant
    mapping(address => uint256) public rmsIdOf;
    mapping(address => uint256) public manIdOf;
    mapping(address => uint256) public disIdOf;
    mapping(address => uint256) public retIdOf;

    modifier validBattery(uint256 _batteryID) {
        require(_batteryID > 0 && _batteryID <= batteryCtr, "Invalid battery ID");
        _;
    }

    modifier validParticipant(address _address, string memory _name) {
        require(_address != address(0), "Invalid address");
        require(bytes(_name).length > 0, "Name is required");
        _;
    }

    function showStage(uint256 _batteryID)
        public
        view
        validBattery(_batteryID)
        returns (string memory)
    {
        STAGE stage = BatteryStock[_batteryID].stage;
        if (stage == STAGE.Init) return "Battery Ordered";
        if (stage == STAGE.RawMaterialSupply) return "Raw Material Supply Stage";
        if (stage == STAGE.Manufacture) return "Manufacturing Stage";
        if (stage == STAGE.Distribution) return "Distribution Stage";
        if (stage == STAGE.Retail) return "Retail Stage";
        return "Battery Sold";
    }

    function addRMS(
        address _address,
        string memory _name,
        string memory _place
    ) public onlyByOwner validParticipant(_address, _name) {
        require(rmsIdOf[_address] == 0, "Address is already a raw material supplier");
        rmsCtr++;
        RMS[rmsCtr] = participant(_address, rmsCtr, _name, _place);
        rmsIdOf[_address] = rmsCtr;
        emit ParticipantAdded("RawMaterialSupplier", rmsCtr, _address, _name);
    }

    function addManufacturer(
        address _address,
        string memory _name,
        string memory _place
    ) public onlyByOwner validParticipant(_address, _name) {
        require(manIdOf[_address] == 0, "Address is already a manufacturer");
        manCtr++;
        MAN[manCtr] = participant(_address, manCtr, _name, _place);
        manIdOf[_address] = manCtr;
        emit ParticipantAdded("Manufacturer", manCtr, _address, _name);
    }

    function addDistributor(
        address _address,
        string memory _name,
        string memory _place
    ) public onlyByOwner validParticipant(_address, _name) {
        require(disIdOf[_address] == 0, "Address is already a distributor");
        disCtr++;
        DIS[disCtr] = participant(_address, disCtr, _name, _place);
        disIdOf[_address] = disCtr;
        emit ParticipantAdded("Distributor", disCtr, _address, _name);
    }

    function addRetailer(
        address _address,
        string memory _name,
        string memory _place
    ) public onlyByOwner validParticipant(_address, _name) {
        require(retIdOf[_address] == 0, "Address is already a retailer");
        retCtr++;
        RET[retCtr] = participant(_address, retCtr, _name, _place);
        retIdOf[_address] = retCtr;
        emit ParticipantAdded("Retailer", retCtr, _address, _name);
    }

    function addBattery(string memory _name, string memory _description)
        public
        onlyByOwner
    {
        require(
            (rmsCtr > 0) && (manCtr > 0) && (disCtr > 0) && (retCtr > 0),
            "Register at least one participant for every role first"
        );
        require(bytes(_name).length > 0, "Name is required");
        batteryCtr++;
        BatteryStock[batteryCtr] = battery(
            batteryCtr,
            _name,
            _description,
            0,
            0,
            0,
            0,
            STAGE.Init
        );
        emit BatteryAdded(batteryCtr, _name);
    }

    function RMSsupply(uint256 _batteryID) public validBattery(_batteryID) {
        uint256 _id = rmsIdOf[msg.sender];
        require(_id > 0, "Caller is not a registered raw material supplier");
        require(BatteryStock[_batteryID].stage == STAGE.Init, "Battery is not in the Ordered stage");
        BatteryStock[_batteryID].RMSid = _id;
        BatteryStock[_batteryID].stage = STAGE.RawMaterialSupply;
        emit StageChanged(_batteryID, STAGE.RawMaterialSupply, msg.sender);
    }

    function Manufacturing(uint256 _batteryID) public validBattery(_batteryID) {
        uint256 _id = manIdOf[msg.sender];
        require(_id > 0, "Caller is not a registered manufacturer");
        require(BatteryStock[_batteryID].stage == STAGE.RawMaterialSupply, "Battery is not in the Raw Material Supply stage");
        BatteryStock[_batteryID].MANid = _id;
        BatteryStock[_batteryID].stage = STAGE.Manufacture;
        emit StageChanged(_batteryID, STAGE.Manufacture, msg.sender);
    }

    function Distribute(uint256 _batteryID) public validBattery(_batteryID) {
        uint256 _id = disIdOf[msg.sender];
        require(_id > 0, "Caller is not a registered distributor");
        require(BatteryStock[_batteryID].stage == STAGE.Manufacture, "Battery is not in the Manufacturing stage");
        BatteryStock[_batteryID].DISid = _id;
        BatteryStock[_batteryID].stage = STAGE.Distribution;
        emit StageChanged(_batteryID, STAGE.Distribution, msg.sender);
    }

    function Retail(uint256 _batteryID) public validBattery(_batteryID) {
        uint256 _id = retIdOf[msg.sender];
        require(_id > 0, "Caller is not a registered retailer");
        require(BatteryStock[_batteryID].stage == STAGE.Distribution, "Battery is not in the Distribution stage");
        BatteryStock[_batteryID].RETid = _id;
        BatteryStock[_batteryID].stage = STAGE.Retail;
        emit StageChanged(_batteryID, STAGE.Retail, msg.sender);
    }

    function sold(uint256 _batteryID) public validBattery(_batteryID) {
        uint256 _id = retIdOf[msg.sender];
        require(_id > 0, "Caller is not a registered retailer");
        require(_id == BatteryStock[_batteryID].RETid, "Only the retailer holding this battery can sell it");
        require(BatteryStock[_batteryID].stage == STAGE.Retail, "Battery is not in the Retail stage");
        BatteryStock[_batteryID].stage = STAGE.Sold;
        emit StageChanged(_batteryID, STAGE.Sold, msg.sender);
    }
}
