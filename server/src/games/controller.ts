import {
  JsonController,
  Authorized,
  CurrentUser,
  Post,
  Param,
  BadRequestError,
  HttpCode,
  NotFoundError,
  ForbiddenError,
  Get,
  Body,
  Patch,
  // Delete
} from 'routing-controllers';
import User from '../users/entity';
import { Game, Player, WinningCell, /*Board*/ } from './entities';
import { /*IsBoard, isValidTransition, */calculateWinner, finished } from './logic';
//import { Validate } from 'class-validator';
import { io } from '../index';

// class GameUpdate {

//   @Validate(IsBoard, {
//     message: 'Not a valid board'
//   })
//   board: Board
// }

@JsonController()
export default class GameController {
  @Authorized()
  @Post('/games')
  @HttpCode(201)
  async createGame(@CurrentUser() user: User) {
    const randomNumber = ():number => Math.floor(Math.random() * 8)

    const winningArray:WinningCell=[];
    for(let i=0;i<16;i++){
      winningArray.push([randomNumber(),randomNumber()])
    }
    
    const entity = await Game.create({winningCell:winningArray}).save();

    await Player.create({
      game: entity,
      user,
      symbol: 'x',
    }).save();

    const game = await Game.findOneById(entity.id);

    io.emit('action', {
      type: 'ADD_GAME',
      payload: game
    });

    return game;
  }

  @Authorized()
  @Post('/games/:id([0-9]+)/players')
  @HttpCode(201)
  async joinGame(@CurrentUser() user: User, @Param('id') gameId: number) {
    const game = await Game.findOneById(gameId);
    if (!game) throw new BadRequestError(`Game does not exist`);
    if (game.status !== 'pending')
      throw new BadRequestError(`Game is already started`);

    game.status = 'started';
    await game.save();

    const player = await Player.create({
      game,
      user,
      symbol: 'o'
    }).save();

    io.emit('action', {
      type: 'UPDATE_GAME',
      payload: await Game.findOneById(game.id)
    });

    return player;
  }

  @Authorized()
  @Patch('/games/:id([0-9]+)')
  async updateGame(
    @CurrentUser() user: User,
    @Param('id') gameId: number,
    @Body() update
  ) {
    const game = await Game.findOneById(gameId);
    if (!game) throw new NotFoundError(`Game does not exist`);

    const player = await Player.findOne({ user, game });

    if (!player) throw new ForbiddenError(`You are not part of this game`);
    if (game.status !== 'started')
      throw new BadRequestError(`The game is not started yet`);
    if (player.symbol !== game.turn)
      throw new BadRequestError(`It's not your turn`);
    // if (!isValidTransition(player.symbol, game.board, update.board)) {
    //   throw new BadRequestError(`Invalid move`);
    // }
console.log('----here----')
console.log(update.clickedCell, game.winningCell, player.symbol);
console.log('----here----')
    //const winner = calculateWinner(update.board)
    const winner = calculateWinner(
      update.clickedCell,
      game.winningCell,
      player.symbol
    );
    if (winner) {
      game.winner = winner;
      game.status = 'finished';
    } else if (finished(update.board)) {
      game.status = 'finished';
    } else {
      game.turn = player.symbol === 'x' ? 'o' : 'x';
    }
    game.board = update.board;
    await game.save();

    io.emit('action', {
      type: 'UPDATE_GAME',
      payload: game
    });

    return game;
  }

  @Authorized()
  @Get('/games/:id([0-9]+)')
  getGame(@Param('id') id: number) {
    return Game.findOneById(id);
  }

  @Authorized()
  @Get('/games')
  getGames() {
    return Game.find();
  }

  // @Authorized()
  // @Delete('/advs/:id([0-9]+)')
  // deleteGame(@Param('id') id: number){
	// 	Game.delete(id)
	// 	return 'game deleted'
  // }

}
