import {filter, foldMap, reduce} from "fp-ts/Array";
import {promises as filesystem} from "fs";

import {Monoid} from "fp-ts/Monoid";
import {pipe} from "fp-ts/function";

import * as ohm from 'ohm-js'
import {IterationNode, Node} from 'ohm-js'

const forAll: Monoid<boolean> = {
    concat: (l: boolean, r:boolean) => l && r,
    empty: true
}

class Round {
    numberOf(colour: Colour){
        return this._counts.get(colour)
    }

    readonly _counts: Map<Colour, number>

    constructor(counts:Array<[string, Colour]>) {
        this._counts = new Map()
        for (const count of counts) {
            this._counts.set(count[1] as Colour, parseInt(count[0]))
        }
    }

    enoughOfFor(aSet: Round) {
        return (colour: Colour) => {
            return (aSet?.numberOf(colour) ?? 0) <= (this?.numberOf(colour) ?? 0)
        }
    }

    couldProvide(possibleSet: Round) {
        return foldMap(forAll)(this.enoughOfFor(possibleSet))(Colours)
    }
}


class Game {
    get gameNumber(): number {
        return parseInt(this._gameNumber)
    }
    private readonly _gameNumber: string

    private readonly _rounds: Round[]

    constructor(id: string, sets: Round[]) {
        this._gameNumber = id
        this._rounds = sets
    }

    gameSetEnoughFor(cubeSupply: Round){
        return (myGame: Round)=>{
            return cubeSupply.couldProvide(myGame)
        }
    }

    couldBePlayedWity(ballSupply: Round) {
        return foldMap(forAll)(this.gameSetEnoughFor(ballSupply))(this._rounds)
    }
}

const Red : "red" = "red"
const Green : "green" = "green"
const Blue : "blue" = "blue"

type Colour = "red" | "green" | "blue"
const Colours:["red", "green", "blue"] = [Red, Green, Blue] // enums are not worth having, they're too non-orthogonal

function createParser() {
    const grammar = ohm.grammar(String.raw`
            BallGames {
                Games = Game+
                
                Game = "Game" number ":" Rounds
                                   
                Rounds = ListOf<Round, ";"> 
                        
                Round = ListOf<Cubes, ",">
                
                Cubes  = number colour
     
                colour = red | blue | green
                red   = "red"
                green = "green"
                blue  = "blue"
                
                number = digit+
            }
        `)

    const gamesActions = {
        Games(list: IterationNode) { // note: Games is a repetition, so the node _is_ an IterationNode
            return list.children.map(child => child.parseGameData())
        }
    }

    const gameActions = {
        Game(tag: Node, id: Node, separator: Node, rounds: Node) {
            return new Game(id.parseNumberData(), rounds.parseRoundsData())
        }
    }

    const roundsActions = {
        Rounds(list: Node) { //note: Rounds is a list, so the node _is not_ an IterationNode
            return list.asIteration().children.map((child: Node) => child.parseRoundData())
        }
    }

    const roundActions = {
        Round(list: Node) {
            return new Round(list.asIteration().children.map((child: Node) => child.parseCubesData()))
        }
    }

    const cubesActions = {
        Cubes(count: Node, colour: Node) {
            return [count.parseNumberData(), colour.sourceString]
        }
    }

    const numberActions = {
        number(digits: IterationNode): string {
            return digits.sourceString
        }
    }

    const gameSemantics = grammar.createSemantics()
    gameSemantics.addOperation('parseGamesData', gamesActions)
    gameSemantics.addOperation('parseGameData', gameActions)
    gameSemantics.addOperation('parseRoundsData', roundsActions)
    gameSemantics.addOperation('parseRoundData', roundActions)
    gameSemantics.addOperation('parseCubesData', cubesActions)
    gameSemantics.addOperation('parseNumberData', numberActions)
    return {grammar, gameSemantics};
}

describe("Advent of Code",()=> {
    describe("using ohm", () => {
        it("builds games",()=> {
            const {grammar, gameSemantics} = createParser();

            const exmapleGames = "Game 17: 3 red, 2 green, 4 blue; 2 red, 4 green, 17 blue \n Game 42: 2 green, 6 blue"
            const matchResult = grammar.match(exmapleGames)
            expect(matchResult.succeeded()).toBeTruthy()

            const games: Game[] = gameSemantics(matchResult).parseGamesData()
            expect(games.length).toEqual(2)
            expect(games[0].gameNumber).toEqual(17)
        })


        it("recognises validity",()=> {
            const {grammar, gameSemantics} = createParser();

            const exmapleGames = "Game 17: 3 red, 2 green, 4 blue; 2 red, 4 green, 17 blue \n Game 42: 2 green, 6 blue"
            const games: Game[] = gameSemantics(grammar.match(exmapleGames)).parseGamesData()
            const cubeSupply = new Round([["12", Red], ["13", Green], ["14", Blue]])
            expect(games[0].couldBePlayedWity(cubeSupply)).toBeFalsy()
            expect(games[1].couldBePlayedWity(cubeSupply)).toBeTruthy()
        })

        it("finds the answer", async () => {
            const {grammar, gameSemantics} = createParser();
            const rawData = await filesystem.readFile('problem_sets/Day2.txt', 'utf-8')
            //console.log(grammar.trace(rawData))
            const matchResult = grammar.match(rawData)
            expect(matchResult.succeeded()).toBeTruthy()
            const games = gameSemantics(matchResult).parseGamesData()

            const cubeSupply = new Round([["12", Red], ["13", Green], ["14", Blue]])

            const result = pipe(games,
                filter((aGame: Game)=>aGame.couldBePlayedWity(cubeSupply)),
                reduce(0, (accumulator: number, aGame: Game) => accumulator + aGame.gameNumber))
            expect(result).toEqual(2447)
        })
    })
})

export{}