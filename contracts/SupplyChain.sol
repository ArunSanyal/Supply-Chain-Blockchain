// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @title Battery supply chain
/// @author ArunSanyal
/// @notice Tracks batteries from order to sale. Each stage can only be performed by an
/// active participant of the matching role, and only from the previous stage.
contract SupplyChain is Ownable2Step, Pausable {
    enum Stage {
        Ordered,
        RawMaterialSupply,
        Manufacture,
        Distribution,
        Retail,
        Sold
    }

    enum Role {
        RawMaterialSupplier,
        Manufacturer,
        Distributor,
        Retailer
    }

    struct Battery {
        uint256 id;
        string name;
        string description;
        uint256 supplierId; //raw material supplier that handled this battery
        uint256 manufacturerId;
        uint256 distributorId;
        uint256 retailerId;
        Stage stage;
    }

    struct Participant {
        address addr;
        bool active; //deactivated participants keep their record but can't act (packed with addr)
        uint256 id; //id within its role, starting at 1
        string name;
        string place;
    }

    error InvalidBattery(uint256 batteryId);
    error InvalidParticipant(Role role, uint256 participantId);
    error InvalidAddress();
    error EmptyName();
    error AlreadyRegistered(Role role, address addr);
    error NotRegistered(Role role);
    error ParticipantInactive(Role role, uint256 participantId);
    error MissingActiveParticipant(Role role);
    error WrongStage(Stage expected, Stage actual);
    error NotBatteryRetailer(uint256 batteryId);

    /// @notice A participant was registered
    /// @param role The participant's role
    /// @param participantId The participant's id within that role
    /// @param addr The participant's address
    /// @param name The participant's name
    event ParticipantAdded(Role indexed role, uint256 indexed participantId, address indexed addr, string name);

    /// @notice A participant's name or place was changed
    /// @param role The participant's role
    /// @param participantId The participant's id within that role
    /// @param name The new name
    /// @param place The new place
    event ParticipantUpdated(Role indexed role, uint256 indexed participantId, string name, string place);

    /// @notice A participant was deactivated
    /// @param role The participant's role
    /// @param participantId The participant's id within that role
    event ParticipantDeactivated(Role indexed role, uint256 indexed participantId);

    /// @notice A battery was ordered
    /// @param batteryId The new battery's id
    /// @param name The battery's name
    event BatteryAdded(uint256 indexed batteryId, string name);

    /// @notice A battery moved to a new stage
    /// @dev Stage history lives in events rather than storage. participantId is 0 for the
    /// initial Ordered stage, which is performed by the owner.
    /// @param batteryId The battery that moved
    /// @param stage The stage it moved to
    /// @param participantId The id (within its role) of the participant that moved it
    /// @param by The address that sent the transaction
    /// @param timestamp The block timestamp
    /// @param location Optional location given by the participant
    /// @param note Optional note given by the participant
    event StageChanged(
        uint256 indexed batteryId,
        Stage stage,
        uint256 participantId,
        address indexed by,
        uint256 timestamp,
        string location,
        string note
    );

    /// @notice Number of batteries ordered so far; ids run from 1 to batteryCount
    uint256 public batteryCount;

    /// @notice Battery records by id
    mapping(uint256 => Battery) public batteries;

    /// @notice Number of participants ever registered per role, including deactivated ones
    mapping(Role => uint256) public participantCount;

    /// @notice Number of active participants per role
    mapping(Role => uint256) public activeParticipantCount;

    /// @notice Participant records by role and id
    mapping(Role => mapping(uint256 => Participant)) public participants;

    /// @notice Participant id by role and address (0 if not registered), so role checks don't loop
    mapping(Role => mapping(address => uint256)) public participantIdOf;

    constructor() Ownable(msg.sender) {}

    modifier validBattery(uint256 batteryId) {
        if (batteryId == 0 || batteryId > batteryCount) revert InvalidBattery(batteryId);
        _;
    }

    /// @notice Blocks ordering and all stage steps until unpaused
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Lifts a pause
    function unpause() external onlyOwner {
        _unpause();
    }

    // ---------------------------------------------------------------- participants

    /// @notice Registers a participant for a role. An address can hold several roles,
    /// but only once per role.
    /// @param role The role to register for
    /// @param addr The participant's address
    /// @param name The participant's name (required)
    /// @param place Where the participant is based
    function addParticipant(
        Role role,
        address addr,
        string calldata name,
        string calldata place
    ) external onlyOwner {
        if (addr == address(0)) revert InvalidAddress();
        if (bytes(name).length == 0) revert EmptyName();
        if (participantIdOf[role][addr] != 0) revert AlreadyRegistered(role, addr);

        uint256 id = ++participantCount[role];
        participants[role][id] = Participant(addr, true, id, name, place);
        participantIdOf[role][addr] = id;
        ++activeParticipantCount[role];
        emit ParticipantAdded(role, id, addr, name);
    }

    /// @notice Changes a participant's name and place. The address can't be changed.
    /// @param role The participant's role
    /// @param id The participant's id within that role
    /// @param name The new name (required)
    /// @param place The new place
    function updateParticipant(
        Role role,
        uint256 id,
        string calldata name,
        string calldata place
    ) external onlyOwner {
        Participant storage p = _participant(role, id);
        if (bytes(name).length == 0) revert EmptyName();
        p.name = name;
        p.place = place;
        emit ParticipantUpdated(role, id, name, place);
    }

    /// @notice Soft-deactivates a participant. The record is kept so batteries it already
    /// handled still show who handled them.
    /// @param role The participant's role
    /// @param id The participant's id within that role
    function deactivateParticipant(Role role, uint256 id) external onlyOwner {
        Participant storage p = _participant(role, id);
        if (!p.active) revert ParticipantInactive(role, id);
        p.active = false;
        --activeParticipantCount[role];
        emit ParticipantDeactivated(role, id);
    }

    // ---------------------------------------------------------------- batteries

    /// @notice Human-readable name of a battery's current stage
    /// @param batteryId The battery to look up
    /// @return The stage name, e.g. "Manufacturing Stage"
    function stageName(uint256 batteryId)
        external
        view
        validBattery(batteryId)
        returns (string memory)
    {
        Stage stage = batteries[batteryId].stage;
        if (stage == Stage.Ordered) return "Battery Ordered";
        if (stage == Stage.RawMaterialSupply) return "Raw Material Supply Stage";
        if (stage == Stage.Manufacture) return "Manufacturing Stage";
        if (stage == Stage.Distribution) return "Distribution Stage";
        if (stage == Stage.Retail) return "Retail Stage";
        return "Battery Sold";
    }

    /// @notice Orders a new battery. Every role needs at least one active participant.
    /// @param name The battery's name (required)
    /// @param description A free-text description
    function addBattery(string calldata name, string calldata description)
        external
        onlyOwner
        whenNotPaused
    {
        for (uint8 r = 0; r < uint8(type(Role).max) + 1; ++r) {
            if (activeParticipantCount[Role(r)] == 0) revert MissingActiveParticipant(Role(r));
        }
        if (bytes(name).length == 0) revert EmptyName();

        uint256 id = ++batteryCount;
        batteries[id] = Battery(id, name, description, 0, 0, 0, 0, Stage.Ordered);
        emit BatteryAdded(id, name);
        emit StageChanged(id, Stage.Ordered, 0, msg.sender, block.timestamp, "", "");
    }

    /// @notice Ordered -> Raw Material Supply. Caller must be an active raw material supplier.
    /// @param batteryId The battery to move
    /// @param location Optional location, stored only in the StageChanged event
    /// @param note Optional note, stored only in the StageChanged event
    function supplyRawMaterials(uint256 batteryId, string calldata location, string calldata note) external {
        batteries[batteryId].supplierId =
            _advance(batteryId, Role.RawMaterialSupplier, Stage.Ordered, location, note);
    }

    /// @notice Raw Material Supply -> Manufacturing. Caller must be an active manufacturer.
    /// @param batteryId The battery to move
    /// @param location Optional location, stored only in the StageChanged event
    /// @param note Optional note, stored only in the StageChanged event
    function manufacture(uint256 batteryId, string calldata location, string calldata note) external {
        batteries[batteryId].manufacturerId =
            _advance(batteryId, Role.Manufacturer, Stage.RawMaterialSupply, location, note);
    }

    /// @notice Manufacturing -> Distribution. Caller must be an active distributor.
    /// @param batteryId The battery to move
    /// @param location Optional location, stored only in the StageChanged event
    /// @param note Optional note, stored only in the StageChanged event
    function distribute(uint256 batteryId, string calldata location, string calldata note) external {
        batteries[batteryId].distributorId =
            _advance(batteryId, Role.Distributor, Stage.Manufacture, location, note);
    }

    /// @notice Distribution -> Retail. Caller must be an active retailer.
    /// @param batteryId The battery to move
    /// @param location Optional location, stored only in the StageChanged event
    /// @param note Optional note, stored only in the StageChanged event
    function retail(uint256 batteryId, string calldata location, string calldata note) external {
        batteries[batteryId].retailerId =
            _advance(batteryId, Role.Retailer, Stage.Distribution, location, note);
    }

    /// @notice Retail -> Sold. Only the retailer that took the battery into Retail can sell it.
    /// @param batteryId The battery to move
    /// @param location Optional location, stored only in the StageChanged event
    /// @param note Optional note, stored only in the StageChanged event
    function markSold(uint256 batteryId, string calldata location, string calldata note) external {
        uint256 retailerId = _advance(batteryId, Role.Retailer, Stage.Retail, location, note);
        if (retailerId != batteries[batteryId].retailerId) revert NotBatteryRetailer(batteryId);
    }

    // ---------------------------------------------------------------- internal

    function _participant(Role role, uint256 id) private view returns (Participant storage) {
        if (id == 0 || id > participantCount[role]) revert InvalidParticipant(role, id);
        return participants[role][id];
    }

    /// @dev Checks the caller's role and the battery's stage, moves the battery to the
    /// next stage and returns the caller's participant id.
    function _advance(
        uint256 batteryId,
        Role role,
        Stage from,
        string calldata location,
        string calldata note
    ) private whenNotPaused validBattery(batteryId) returns (uint256 participantId) {
        participantId = participantIdOf[role][msg.sender];
        if (participantId == 0) revert NotRegistered(role);
        if (!participants[role][participantId].active) revert ParticipantInactive(role, participantId);

        Battery storage b = batteries[batteryId];
        if (b.stage != from) revert WrongStage(from, b.stage);

        Stage next = Stage(uint8(from) + 1);
        b.stage = next;
        emit StageChanged(batteryId, next, participantId, msg.sender, block.timestamp, location, note);
    }
}
