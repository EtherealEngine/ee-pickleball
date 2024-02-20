### Ethereal Engine Pong

# Gameplay

1) When one or more players enters a goal then play is started
2) When all players leave all goals then play stops
3) If a ball hits a player goal then that player takes damage; at maximum damage the game ends
4) volleying is automatic

# Code

The game objects are arranged like so and there can be any number of players:

```
  pong
    goal
      paddle
      paddle
      plate
      score
```

A pong game is started when a player is on any plate, and ended when there are no players on any plates
While the game is started balls are volleyed in order to each player
When a plate is hit more than 9 times a game ends

# Todo / Issues [minor]

- ball is moved by a dispatch, this is not elegant, there's a bug where server implicit change doesn't network
- discovery of parts could be done at startup only; minor but could improve
- clients don't need to do full discovery of all part relationships; minor
- only server needs to delegate authority; minor
- don't let avatars own more than one set of paddles; minor
- move entire TextComponent feature out of pong into etherealengine as a general reasource
- and also fetch font more directly; rather than from 3js github repo

## Features to consider later

- perhaps some win effect?
- optionally a robot player?
- different shaped volumes
- obstacles
- gravity, attractors, fans etc
- nicer paddle art
- nicer table art

## behave graph variant todo

* ontick ball launcher
  x ? some kind of bug with trying to set forces on the ball -> looks like broken code in the engine
  - if game started test -> we could have a game reset pad
  * periodically launch the ball

* plate collider
  * if it is a ball -> then increase damage -> reset ball
    * if damage is greater than 9 then end game
  - if it is an avatar -> if game is stopped then start game

- if ball hit ground -> reset ball

