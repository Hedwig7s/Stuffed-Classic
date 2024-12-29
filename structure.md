# Project Structure

- `../main.ts` - Initializes the server, main entrypoint

- `contextmanager.ts`
  - `ContextManager` class: Contains all shared state in the program

## data/

Files related to in memory data storage and file storage

- `data/blocks.ts` - BlockIds enum and protocol replacements for older protocols

### data/config/

Files related to configuration

- `data/config.ts`
  - `Config` class: Manages loading, saving and accessing configuration files
- `data/configfilehandlers.ts` - API compatible parsers/encoders for different config file formats
- `data/constants.ts` - Shared constants in the program

### data/configs/

Default formats for all configuration files

- `data/configs/`
  - `main.ts` - Main server configuration

### data/worlds/

- `data/worlds/world.ts`
  - `World` class: Handles loading, saving and network packing worlds
- `data/worlds/worldmanager.ts`
  - `WorldManager` class: Stores a collection of worlds and allows for autosaving

#### data/worlds/parsers/

Contains world parsers that encode, decode and identify world files

- `data/worlds/parsers/base.ts` - Basic interface for world parsers
- `data/worlds/parsers/hworld.ts`
  - `HWorldParser` class: Parses the hworld file format

## datatypes/

Classes for storing specific, generic data, should generally be portable

- `datatypes/entityposition.ts`
  - `EntityPosition` class: Datatype for the position of an entity (x,y,z,yaw,pitch)
- `datatypes/vector3.ts`
  - `Vector3` class: Datatype for 3D position (x,y,z)

## entities/

- `entities/entity.ts`
  - `Entity` class: Handles an entity which can be spawned, despawned and moved
- `entities/entityregistry.ts`
  - `EntityRegistry` class: Registry that stores entities and assigns a UUID to each
- `entities/playerentity.ts`
  - `PlayerEntity` class: Entity which proxies information to its player and client

## networking/

Files pertaining to client communication

### networking/packet/

- `networking/packet/broadcaster.ts`
  - `Broadcaster` class: Broadcasts a message of a specific packet to all connections that meet a criteria (if any), with modifications per connection via a modifier (if any)
- `networking/packet/broadcasterutil.ts` - Contains common criteria and modifiers
- `networking/packet/factories.ts` - Factories for specific packet types
  - `createBasicPacket` - Creates a basic packet with no sender or receiver. Not intended for general use
  - `createSendablePacket` - Creates a packet with a sender
  - `createReceivablePacket` - Creates a packet with a receiver
  - `createBidirectionalPacket` - Creates a packet with both a sender and receiver
- `networking/packet/packet.ts`
  - `Packet` interface: Basic packet structure
  - `SendablePacket` interface: Packet with a send method for sending data to a client
  - `ReceivablePacket` interface: Packet with a receive method that processes incoming data
- `networking/packet/packetdata.ts` - Contains interfaces defining specific data formats for each packet

### networking/protocol/

- `networking/protocol/protocol.ts`
  - `Protocol` class: Container for an entire protocol structure. Generally protocol version, packets, and a method for identifying a packet as a handshake (identification) packet

#### networking/protocol/7/

- `networking/protocol/7/packets.ts` - Packets for protocol 7
- `networking/protocol/7/protocol.ts` - Protocol 7 implementation

### networking/server/

- `networking/server.ts`
  - `Server` class: Handles setting up the TCP server to accept new connections
  - `Connection` class: Handles an ongoing connection to a client, queuing and handling incoming data from a client via packets

## player/

- `player/player.ts`
  - `Player` class: Higher level client class for containing all player related class instances and doing player actions (such as chatting)

## utility/

General miscellaneous utility functions and classes, generally portable

- `utility/dataparser.ts`
  - `BinaryParser` class: Encodes and decodes binary data based on a format list. Also does rudementary data verification
  - `ParserBuilder` class: Builds a BinaryParser based on chained arguments (such as endianness and data)
- `utility/fixed.ts` - Functions for converting a number to and from fixed point representation
- `utility/logger.ts` - Basic logger factory
