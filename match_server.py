"""Authoritative local match clock/commands, independent of browser scheduling."""
import copy
import uuid

BREAK_MS = 3000
MAX_INTEGER = 9007199254740991
SETTINGS = {'mode', 'language', 'blueName', 'redName', 'blueImage', 'redImage', 'duration',
            'giftInfoPosition', 'blueAttackGifts', 'redAttackGifts', 'blueHealGift', 'redHealGift'}


def target(mode):
    return {'single': 1, 'best3': 2, 'best5': 3}.get(mode, float('inf'))


def fresh_round(state, now, new_match=False):
    state.update(phase='running', round=1 if new_match else state['round'] + 1,
                 blueHp=100, redHp=100, blueVotes=0, redVotes=0, blueCoins=0, redCoins=0,
                 winner=None, seriesWinner=None, action=None, remaining=state['duration'],
                 remainingMs=state['duration'] * 1000, startedAt=now,
                 endsAt=now + state['duration'] * 1000, nextRoundAt=0)
    if new_match:
        state.update(blueScore=0, redScore=0)


def reset_match(state):
    state.update(phase='ready', round=1, blueScore=0, redScore=0, blueHp=100, redHp=100,
                 blueVotes=0, redVotes=0, blueCoins=0, redCoins=0, winner=None,
                 seriesWinner=None, action=None, remaining=state['duration'],
                 remainingMs=state['duration'] * 1000, startedAt=0, endsAt=0, nextRoundAt=0)


def settle(state, winner, now):
    if state['phase'] != 'running':
        return
    if winner != 'draw':
        state[winner + 'Score'] += 1
    champion = 'blue' if state['blueScore'] >= target(state['mode']) else 'red' if state['redScore'] >= target(state['mode']) else None
    continuing = state['mode'] == 'endless' or state['mode'] in ('best3', 'best5') and not champion
    remaining_ms = max(0, state['endsAt'] - now)
    state.update(phase='intermission' if continuing else 'finished', winner=winner,
                 seriesWinner=champion, remaining=(remaining_ms + 999) // 1000,
                 remainingMs=remaining_ms, endsAt=0, nextRoundAt=now + BREAK_MS if continuing else 0)


def clock_tick(value, now):
    if value is None:
        return None
    state = copy.deepcopy(value)
    if state['phase'] == 'running' and now >= state['endsAt']:
        winner = 'draw' if state['blueHp'] == state['redHp'] else 'blue' if state['blueHp'] > state['redHp'] else 'red'
        settle(state, winner, now)
    elif state['phase'] == 'intermission' and now >= state['nextRoundAt']:
        fresh_round(state, now)
    elif state['mode'] == 'endless' and state['phase'] == 'finished':
        # Recover a previously stuck result without awarding the same point again.
        state.update(phase='intermission', seriesWinner=None, endsAt=0, nextRoundAt=now + BREAK_MS)
    else:
        return None
    state['revision'] = max(now, value['revision'] + 1)
    return state


def command(value, data, now, catalog):
    if value is None or not isinstance(data, dict) or data.get('type') not in ('start', 'reset', 'pause', 'settings', 'gift'):
        raise ValueError('Invalid command')
    state = copy.deepcopy(value)
    kind = data['type']
    if kind == 'start':
        if state['phase'] == 'paused':
            if state['winner']:
                fresh_round(state, now)
            else:
                state.update(phase='running', endsAt=now + state['remainingMs'], action=None)
        elif state['phase'] in ('ready', 'finished'):
            fresh_round(state, now, new_match=True)
    elif kind == 'reset':
        reset_match(state)
    elif kind == 'pause' and state['phase'] in ('running', 'intermission'):
        remaining = max(0, state['endsAt'] - now) if state['phase'] == 'running' else state['remainingMs']
        state.update(phase='paused', remainingMs=remaining, remaining=(remaining + 999) // 1000, endsAt=0, nextRoundAt=0)
    elif kind == 'settings':
        patch = data.get('patch')
        if not isinstance(patch, dict) or not set(patch).issubset(SETTINGS):
            raise ValueError('Invalid settings')
        old_mode = state['mode']
        if patch.get('mode', old_mode) != old_mode and state['phase'] not in ('ready', 'finished'):
            raise ValueError('Reset before changing mode')
        state.update(patch)
        if state['mode'] != old_mode:
            reset_match(state)
        elif state['phase'] in ('ready', 'finished'):
            state.update(remaining=state['duration'], remainingMs=state['duration'] * 1000)
    elif kind == 'gift':
        gift_id, count = data.get('giftId'), data.get('count', 1)
        if not isinstance(gift_id, str) or type(count) is not int or not 1 <= count <= 100000:
            raise ValueError('Invalid gift')
        gift = catalog.get(gift_id)
        if gift and state['phase'] == 'running':
            for side in ('blue', 'red'):
                healing = state[side + 'HealGift'] == gift_id
                if healing or gift_id in state[side + 'AttackGifts']:
                    power = gift['coins'] * count
                    if type(power) is not int or not 1 <= power <= MAX_INTEGER:
                        raise ValueError('Invalid coin value')
                    field = (side if healing else 'red' if side == 'blue' else 'blue') + 'Hp'
                    hp = min(100, max(0, state[field] + (power if healing else -power)))
                    amount = abs(hp - state[field])
                    state[field] = hp
                    state[side + 'Coins'] = min(MAX_INTEGER, state[side + 'Coins'] + power)
                    state['action'] = dict(side=side, type='heal' if healing else 'gift', power=power,
                                           amount=amount, giftId=gift_id, name=gift['name'], at=now, id=str(uuid.uuid4()))
                    if not healing and hp == 0:
                        settle(state, side, now)
                    break
    state['revision'] = max(now, value['revision'] + 1)
    return state
