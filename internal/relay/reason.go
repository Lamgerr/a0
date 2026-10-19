package relay

import (
	"bytes"
	"encoding/json"
	"io"
)

// The reasoning shards: upstreams disagree on where chain-of-thought rides a
// streaming delta. deepseek/llm7 style puts it in `reasoning_content`; groq,
// kilo's nemotron brand and pollinations put it in `reasoning` (once with an
// object, once as a string, and pollinations hangs it off `message` too).
//
// ruleShim rewrites complete `data:` lines of an SSE stream so every client
// that lights a thinking pane on `reasoning_content` sees one: a string
// `reasoning` without a sibling `reasoning_content` gains the alias alongside
// it. Everything else — [DONE], comments, non-SSE bodies, reasoning objects —
// passes byte-for-byte verbatim.
const reasoningAliasField = "reasoning_content"

type reasonShim struct {
	w   io.Writer
	buf []byte // carried partial line between writes
}

func newReasonShim(w io.Writer) *reasonShim { return &reasonShim{w: w} }

// Write consumes one read chunk: complete lines are rewritten and emitted, a
// trailing partial line is carried to the next Write. SSE payloads are single
// JSON lines — a split never lands inside a value, waiting for '\n' is safe.
func (s *reasonShim) Write(p []byte) (int, error) {
	s.buf = append(s.buf, p...)
	for {
		i := bytes.IndexByte(s.buf, '\n')
		if i < 0 {
			break
		}
		_, _ = s.w.Write(rewriteReasonLine(s.buf[:i+1]))
		s.buf = s.buf[i+1:]
	}
	return len(p), nil
}

// Close flushes the carried tail verbatim (EOF or upstream mid-body death).
func (s *reasonShim) Close() {
	if len(s.buf) > 0 {
		_, _ = s.w.Write(s.buf)
		s.buf = nil
	}
}

// rewriteReasonLine swaps one complete line; anything that is not a `data:`
// JSON object goes back untouched.
func rewriteReasonLine(line []byte) []byte {
	payload, ok := dataPayload(line)
	if !ok {
		return line
	}
	var obj map[string]any
	if json.Unmarshal(payload, &obj) != nil {
		return line
	}
	if !aliasReasoning(obj) {
		return line
	}
	out, err := json.Marshal(obj)
	if err != nil {
		return line
	}
	return append(append([]byte("data: "), bytes.TrimRight(out, " ")...), '\n')
}

// dataPayload strips the `data:` prefix (with or without a space) and reports
// whether the remainder is a JSON object.
func dataPayload(line []byte) ([]byte, bool) {
	if !bytes.HasPrefix(line, []byte("data:")) {
		return nil, false
	}
	payload := bytes.TrimSpace(line[len("data:"):])
	if len(payload) == 0 || payload[0] != '{' {
		return nil, false // [DONE], comments, bare scalars
	}
	return payload, true
}

// aliasReasoning walks choices[].delta and choices[].message giving every
// string `reasoning` a sibling `reasoning_content` (the original is kept —
// clients reading either spelling are served). Empty and non-string reasoning
// is left alone. Reports whether anything was rewritten.
func aliasReasoning(obj map[string]any) bool {
	changed := false
	choices, ok := obj["choices"].([]any)
	if !ok {
		return false
	}
	for _, c := range choices {
		cm, ok := c.(map[string]any)
		if !ok {
			continue
		}
		for _, slot := range []string{"delta", "message"} {
			d, ok := cm[slot].(map[string]any)
			if !ok {
				continue
			}
			r, ok := d["reasoning"].(string)
			if !ok || r == "" {
				continue
			}
			if _, has := d[reasoningAliasField]; has {
				continue
			}
			d[reasoningAliasField] = r
			changed = true
		}
	}
	return changed
}
