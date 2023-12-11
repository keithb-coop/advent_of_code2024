import {filter, foldMap, map, reduce} from "fp-ts/Array";
import {promises as filesystem} from "fs";

import {Monoid} from "fp-ts/Monoid";
import {pipe} from "fp-ts/function";

import * as ohm from 'ohm-js'

function createParser() {
    const grammar = ohm.grammar(String.raw`
        `)

    const gameSemantics = grammar.createSemantics()
    gameSemantics.addOperation()
    return {grammar, gameSemantics};
}


describe("Advent of Code",()=> {
    describe("using ohm", () => {
        describe("Day 3",()=> {
            describe("Part 1", () => {

                it("finds the answer", async () => {
                    const rawData = await filesystem.readFile('problem_sets/Day3.txt', 'utf-8')

                })
            })
        })
    })
})

export{}
