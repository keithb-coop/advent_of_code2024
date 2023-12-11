import {filter, foldMap, map, reduce} from "fp-ts/Array";
import {promises as filesystem} from "fs";

import {Monoid} from "fp-ts/Monoid";
import {pipe} from "fp-ts/function";

import * as ohm from 'ohm-js'

// These handy monoids will be used in applications of foldMap
const forAll: Monoid<boolean> = {
    concat: (l, r) => l && r,
    empty: true
}

const sumAll: Monoid<number> = {
    concat: (l, r) => l + r,
    empty: 0
}

class Round {

    readonly _counts: Map<Colour, number>

    constructor(counts:Array<[number, Colour]>) {
        this._counts = new Map()
        for (const count of counts) {
            this._counts.set(count[1] as Colour, count[0])
        }
    }

    numberOf(colour: Colour){
        return this._counts.get(colour)
    }

    enoughOfFor(aSet: Round) {
        return (colour: Colour) => {
            return (aSet?.numberOf(colour) ?? 0) <= (this?.numberOf(colour) ?? 0) //null handling to keep TS happy
        }
    }

    couldProvide(candidateSet: Round) {
        return foldMap(forAll)(this.enoughOfFor(candidateSet))(Colours) //don't much like this curried syntax
    }

    get power() {
        //it would be nice to use reduce() here but it's hard to get at the underlying array, it's always hidden behind an Iterable
        let result = 1
        this._counts.forEach((value, _key) => result = result * value) // yuk
        return result
    }

    minimumRequiredWith(anotherRound: Round): Round {
        return new Round(pipe(Colours,
            map((colour: Colour) => [this.biggerCount(colour, anotherRound), colour as Colour])))
    }

    private biggerCount(colour: Colour, anotherRound: Round):number {
        return Math.max(this.numberOf(colour) ?? 0, anotherRound?.numberOf(colour) ?? 0);
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

    couldBePlayedWity(ballSupply: Round) {
        return foldMap(forAll)((myGame: Round) => ballSupply.couldProvide(myGame))(this._rounds)
    }

    get minimumCubeSupply(): Round{
        return pipe(this._rounds,
            reduce(new Round([[0, Red], [0, Green], [0, Blue]]),
                (accumulator, next: Round) => accumulator.minimumRequiredWith(next)))
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
     
                colour = "${Red}" | "${Blue}" | "${Green}" //nice!
             
                number = digit+
            }
        `)

    const gameSemantics = grammar.createSemantics()
    gameSemantics.addOperation('parseGamesData', {
        Games(list) { // note: Games is a repetition, so the node _is_ an IterationNode
            return list.children.map(child => child.parseGameData())
        }
    }).addOperation('parseGameData', {
        Game(_tag, id, _colon, rounds) {
            return new Game(id.parseNumberData(), rounds.parseRoundsData())
        }
    }).addOperation('parseRoundsData', {
        Rounds(list) { //note: Rounds is a list, so the node _is not_ an IterationNode
            return list.asIteration().children.map((child) => child.parseRoundData())
        }
    }).addOperation('parseRoundData', {
        Round(list) {
            return new Round(list.asIteration().children.map((child) => child.parseCubesData()))
        }
    }).addOperation('parseCubesData', {
        Cubes(count, colour) {
            return [parseInt(count.parseNumberData()), colour.sourceString]
        }
    }).addOperation('parseNumberData', {
        number(digits): string {
            return digits.sourceString
        }
    })
    return {grammar, gameSemantics};
}

function sumIdsOfPossibleGames(games: Game[], cubeSupply: Round) {
    return pipe(games,
        filter((aGame: Game) => aGame.couldBePlayedWity(cubeSupply)),
        reduce(0,
            (accumulator: number, aGame: Game) => accumulator + aGame.gameNumber));
}

function makeGames(rawData: string) {
    const {grammar, gameSemantics} = createParser();
    return gameSemantics(grammar.match(rawData)).parseGamesData();
}

function findPowerSumMinimumSets(games: Game[]) {
    return foldMap(sumAll)((g: Game) => g.minimumCubeSupply.power)(games) //could have been a pipe with map() and reduce()
}

describe("Advent of Code",()=> {
    describe("using ohm", () => {
        describe("Day 2",()=> {
            describe("Part 1", () => {
                it("builds games", () => {

                    const {grammar, gameSemantics} = createParser();
                    const exmapleGames = "Game 17: 3 red, 2 green, 4 blue; 2 red, 4 green, 17 blue \n Game 42: 2 green, 6 blue"
                    expect(grammar.match(exmapleGames).succeeded()).toBeTruthy()

                    const games: Game[] = gameSemantics(grammar.match(exmapleGames)).parseGamesData()
                    expect(games.length).toEqual(2)
                    expect(games[0].gameNumber).toEqual(17)
                })

                it("recognises validity", () => {
                    const {grammar, gameSemantics} = createParser();

                    const exmapleGames = "Game 17: 3 red, 2 green, 4 blue; 2 red, 4 green, 17 blue \n Game 42: 2 green, 6 blue"
                    const games: Game[] = gameSemantics(grammar.match(exmapleGames)).parseGamesData()
                    const cubeSupply = new Round([[12, Red], [13, Green], [14, Blue]])
                    expect(games[0].couldBePlayedWity(cubeSupply)).toBeFalsy()
                    expect(games[1].couldBePlayedWity(cubeSupply)).toBeTruthy()
                })

                it("finds the answer", async () => {
                    const rawData = await filesystem.readFile('problem_sets/Day2.txt', 'utf-8')
                    //console.log(grammar.trace(rawData))
                    const games = makeGames(rawData)
                    const cubeSupply = new Round([[12, Red], [13, Green], [14, Blue]])
                    expect(sumIdsOfPossibleGames(games, cubeSupply)).toEqual(2447)
                })
            })
        })

        describe("day 2",()=>{
            it("Calculates powers",() => {
                const aRound = new Round([[4, Red], [2, Green], [6, Blue]])
                expect(aRound.power).toEqual(48)
                const anotherRound = new Round([[1, Red], [3, Green], [4, Blue]])
                expect(anotherRound.power).toEqual(12)
            })

            it("makes minimum rounds",()=>{
                const aRound = new Round([[4, Red], [2, Green], [6, Blue]])
                const anotherRound = new Round([[7, Red], [1, Green], [6, Blue]])
                expect(aRound.minimumRequiredWith(anotherRound)).toEqual(new Round([[7, Red],[2, Green],[6, Blue]]))
            })

            it.each([
                [makeGames("Game 1: 3 blue, 4 red; 1 red, 2 green, 6 blue; 2 green"), 4, 2, 6],
                [makeGames("Game 2: 1 blue, 2 green; 3 green, 4 blue, 1 red; 1 green, 1 blue"), 1, 3, 4],
                [makeGames("Game 3: 8 green, 6 blue, 20 red; 5 blue, 4 red, 13 green; 5 green, 1 red"), 20, 13, 6],
                [makeGames("Game 4: 1 green, 3 red, 6 blue; 3 green, 6 red; 3 green, 15 blue, 14 red"), 14, 3, 15],
                [makeGames("Game 5: 6 red, 1 blue, 3 green; 2 blue, 1 red, 2 green"), 6, 3, 2]])
            ("finds minimum cube supply",(games, r,g,b) => {
                expect(games[0].minimumCubeSupply).toEqual(new Round ([[r, Red], [g, Green], [b, Blue]]))
            })

            it("finds the answer",async ()=>{
                const exampleGames = makeGames(String.raw`
                    Game 1: 3 blue, 4 red; 1 red, 2 green, 6 blue; 2 green
                    Game 2: 1 blue, 2 green; 3 green, 4 blue, 1 red; 1 green, 1 blue
                    Game 3: 8 green, 6 blue, 20 red; 5 blue, 4 red, 13 green; 5 green, 1 red
                    Game 4: 1 green, 3 red, 6 blue; 3 green, 6 red; 3 green, 15 blue, 14 red
                    Game 5: 6 red, 1 blue, 3 green; 2 blue, 1 red, 2 green
                `)

                const result =
                        findPowerSumMinimumSets(exampleGames)

                expect(result).toEqual(2286)

                const rawData = await filesystem.readFile('problem_sets/Day2.txt', 'utf-8')
                const games = makeGames(rawData)
                expect(findPowerSumMinimumSets(games)).toEqual(56322)

            })
        })
    })
})

export{}
